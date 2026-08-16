# Roteiro do dia — handoff

Branch `feature/roteiro-do-dia-p1-20260815`, tree clean. Last work 2026-08-16:
a second full simulator sweep (§7), the day grid's drag, the quick sheet and
Perfil (§8), lunch moving from a preference to a calendar block (§9), and the
day's budget, the missing break and what comes next (§10).

**Read §10 and §9 first if you are picking this up cold.** Between them they
change what every generated day looks like: no rep gets a lunch break unless
they have put one on their own calendar, and `dailyLimit` now counts the visits
already in the diary rather than only the ones the engine adds.

Spec: `requirements.md` in this folder. Section numbers below refer to it.

---

## How to run it

```bash
# API — 3021 is this worktree's port. 3012 and 3020 belong to other lanes.
cd apps/api && PORT=3021 bun run dev

# App — the config file points at 3020, so the override is required
cd apps/mobile && fvm flutter run -d <iPhone 17 udid> \
  --dart-define-from-file=config.development.json \
  --dart-define=API_BASE_URL=http://localhost:3021
```

`apps/api/.env` points at **`atlasmed_roteiro_p1`** on `localhost:5434`. The
simulator's fixed GPS is Rio, which matches rep 2 (Adriana Oliveira, 146
clinics); rep 4's book is Paraná and will read as out of range from there.

⚠️ **It used to point at `atlasmed_scratch`, and that database was emptied twice
on 2026-08-15** — once mid-session, and again within five minutes of being
restored. The second time it came back with 119 migrations where this branch
has 122, so it was dropped and recreated by something on an older branch, not
merely truncated.

`atlasmed_scratch` is one of the three names the tooling itself treats as
disposable — `db:push` names `atlasmed_test`, `atlasmed_scratch` and
`atlasmed_empty` as the only databases it will overwrite. Any lane's DB tests
may reset it. It was never a safe home for a working dataset, which is why this
worktree now has its own name that nothing else claims.

To rebuild it: `create database atlasmed_roteiro_p1 template
atlasmed_prod_snapshot`, then `DATABASE_URL=… bun run db:migrate` from
`packages/database` — the snapshot's journal is intact, so migrate applies only
what this branch adds. Stop the API first; the drop fails while it holds
connections.

**Verify SQL against Postgres, not only in unit tests.** Six defects this
session were invisible to `bun test` and `tsc` and only appeared against a real
database: a missing comma between CTEs, a column computed and never projected,
an untyped `else 0` collapsing a CASE to integer, two backticks terminating a SQL
template literal, and a REMOTE start closing an in-person visit.

---

## Done

### Engine (`apps/api/src/modules/roteiro`)

- **Per-bucket visit durations** replacing the flat 45 (§15.5.4). MANTER 30,
  RECUPERAR 60, PROSPECTAR 60, all whole calendar slots because the calendar
  rounds up and a 45 was always lived as a 60.
- **Measured durations replace the guess** once a bucket has ≥12 completed
  visits in 180 days (§15.5.4). Median, not mean. Only `MEASURED` trains it.
- **Duration and time overrides** from the rep, planned *with* rather than
  applied after — duration is the denominator of the gain a stop is chosen on.
  A pinned time becomes a fixed point, so re-planning cannot move it.
- **CNES absent ≠ zero** (§15.5.3). 216 of 1442 profiles have no staff row and
  used to score 0. Measured: at `capacityUnknown = 0` only 6 unknown clinics
  survived a 400-deep shortlist; at 0.40, 35 do.
- **Rejection as routing, not scoring** (§15.5.2). Reasons are not comparable.
  Penalties sum and decay on a 90-day half-life, capped at 0.15 merit. Coverage
  slot immune. `FECHADA` is global; everything else is per (rep, clinic).
- **Per-rep working hours** (§15.5.5), stored in `users.metadata -> preferences`.
  Each field falls back independently; null means *not set*, never 08:00.
- **Coverage rotates on visits, not intentions** (§15.6.6-1). It used to read
  `last_suggested_at`, stamped on confirm — a rep who planned a day and stayed
  home hid five clinics for a quarter.
- **`cooldown_days` is applied at all** (§15.6.6-2). It was specified in §4.1,
  stored, exposed to ops, and used nowhere.

### Outcome capture (`apps/api/src/modules/interactions`, §15.6)

- **Close-on-next-arrival**: starting an in-person visit closes any in-person
  visit left open, any clinic, any order, `MEASURED`, with a SYSTEM event.
- **Workday-end auto-close**, `INFERRED`, never before `start + 30 min`.
- **`duration_source`**: only `MEASURED` trains the median. An inferred close at
  the planned time would teach the engine its own guess.
- **Two questions** (§15.6.4): *Como foi?* and *Quando voltar?*. The second
  governs the coverage rotation — verified that a clinic visited 40 days ago is
  not overdue on the 90-day horizon, becomes overdue when the rep said 30 dias,
  and stays quiet at 90.
- `POST /interactions/:id/outcome`, answerable on any `COMPLETED` visit and
  offered as *"Como foi a visita?"* on ones closed for the rep.

### Mobile

- **Agenda month landing → day hour grid** (`AgendaMonthScreen`, `AgendaDayScreen`).
- **Drag-to-schedule**: long-press empty grid draws a block, handles resize it,
  the middle moves it, a bar underneath names it. Clashes turn amber and name
  what they hit. "Mais opções" opens the full editor **on that block**.
- **Roteiro workspace**: five slots (suggestion / booked / empty), per-stop
  duration and time editing with a ripple that moves the day in the direction of
  the change, rejection sheet on the second removal.
- Deleted `AgendaScreen` and its dependents — 1562 lines, including a 469-line
  test file that passed every run while testing a screen nobody could open.

---

## Left to do

### 1. Rotate the Mapbox token — **for the human, not the agent**

An `sk.…` secret token was pasted in plain text early in the session. Still
live. Flagged repeatedly; never done.

### 2. Nobody has used any of this

Every path now works and has been driven end to end — but by an agent on a
simulator, twice, not by a rep. Everything below the surface has been checked
against a real database; the riskiest assumption in the feature, that reps want
it in this shape, is still untested and cannot be tested from here.

Worth knowing when reading the earlier sweeps: part of why `visits` was empty
was that the capture loop *could not work* — start, complete, outcome and
arrival never sent `Content-Type`, so the server parsed no body. That is fixed,
and the loop has since been exercised many times.

Note what this gates: aderência, conversão and validated potential (the rest of
P5) are all waiting on usage, not on code.

### 3. ~~Three places disagree about when a rep works~~ — done

Working hours are the rep's own, with the linha as the fallback per field.
**Lunch is no longer one of them** — see §9. It is a personal block on the
rep's calendar, which the engine plans around like any other commitment.

The slot picker reads the rep's own hours. Its window is the rep's day widened
by an hour either side, plus far enough to reach the time being edited and
anything already booked; slots outside the working day are marked *fora* and
stay pickable. Perfil is reached by tapping the drawer header. Verified on
device: 10:00 stored, picker and speed dial both followed it.

### 4. Not built at all (§15.6.5, §15.6.7)

- ~~**"Cheguei" on the clinic page.**~~ Done. `POST /interactions/arrivals`
  creates the calendar row and the interaction together, already started, and
  closes whatever the rep left open through the same `visitsClosedByArrival`
  rule. It does not run the conflict check: arriving somewhere is a fact, and
  refusing to record it because the rep's own calendar disagrees is the failure
  the spec describes. Verified against Postgres.
- ~~**Offline stamping.**~~ Done, both halves.

  **The contract**: start, complete and arrival accept an instant from the
  device, and `resolveClientInstant` decides whether to believe it — absent
  means now, small skew is clamped, the future and anything over a day old are
  refused. Verified against Postgres: a 90-minute-old arrival anchors to the
  hour the rep was there and a completion an hour later reports 60 minutes, not
  the queue's latency.

  **The queue**: `CaptureQueue` persists the press with its stamp in Hive and
  replays it when there is a network. Oldest first, and one unreachable entry
  halts the drain rather than being skipped — an arrival closes whichever visit
  the rep left open, so sending the second past a stuck first would close the
  wrong one. A refusal is dropped and reported rather than retried for ever, and
  so is a stamp too old for the server to accept. Each entry replays under the
  key it was queued with. A banner on the day screen counts what is waiting.

  Covers arrival, start and complete. Planning is deliberately not queued: a
  create needs the server's answer about conflicts.

  ✅ **Driven on 2026-08-16.** With the API stopped, two presses queued and the
  banner read "2 registros aguardando envio". With it back, *Enviar agora*
  drained them: the visit starts at 06:57:36 — the instant the button was
  pressed — against a lifecycle event stamped 06:59:10, ninety-four seconds
  later. That gap is the whole feature. The duplicate second press was refused
  and dropped rather than retried for ever.
- **Push reminder with an "Iniciar" action.** Still not built, and not
  buildable from here: `firebase_messaging` is absent, there is no device-token
  store, nothing reads `pushNotificationsEnabled` — and standing it up needs a
  Firebase project and an APNs key, which are the account holder's to create.
  That is the blocker, not the code.
- **Geofence arrival/exit.** Still not built. `geolocator` is one-shot and
  foreground, permission is When-In-Use, no background mode declared. Beyond the
  code, this one needs a product decision first: continuous background location
  is a battery and privacy cost a rep has to agree to, and App Store review asks
  why. Worth doing only once reps say the manual *Cheguei* is too much friction
  — which nobody has used enough to know.

### 5. Found by the full simulator sweep (2026-08-16)

Driven on the iPhone 17 against the restored book, with every write checked in
Postgres. Four defects, three of them invisible until the capture loop was used
for the first time.

**The capture loop could never have worked from the app.** `start`, `complete`,
`outcome` and `arrival` never sent `Content-Type: application/json`, so Elysia
parsed no body and rejected fields that had plainly been sent — 400 with
`"found": {}`. The calendar mutations always set it; these four never did.
This reframes "nobody has pressed *Iniciar interação*": part of it is that the
button could not work. No test caught it because none crosses the real HTTP
layer — the repository tests assert against a recording client that accepts a
body no server would parse.

**Explorar 500s once a rep has actually visited anything.** `loadLastVisitAt`
declared `sql<Date>` over a `max()` aggregate — an assertion, not a conversion —
and the mapper called `.toISOString()` on the string postgres returned. It could
only fire for a facility with a `visits` row, and none existed until then. Two
arrivals in, the clinic list died and the rep's whole book became a retry
button.

**Editing a series ate the weeks before the one you opened.** The form seeded
from the tapped occurrence and the server writes `startsAt` as the series
anchor, so changing only a duration on week three deleted weeks one and two.
The list DTO now carries `anchorLocalDate`/`anchorLocalTime`.

**The arrival confirmation never went away.** `SnackBar.persist` defaults to
`action != null` and the dismiss timer returns early on it, so any snackbar with
an action stays until something replaces it.

~~**Still open — a completed visit draws the plan.**~~ Fixed; see §7.

**Verified working**: drag-to-create, resize, drag-by-middle, clash warnings,
"Mais opções" carrying date/time/kind, the 409 with its detailed message,
recurrence creation and month expansion, the occurrence-vs-series chooser,
"Editar toda a série", clinic search scoped to Rio, Rota, the drawer→Perfil
chevron, Desempenho and Explorar on the real book, Cheguei writing IN_PROGRESS
with the press instant, close-on-next-arrival closing the previous visit
COMPLETED/MEASURED with a `visits` row and a SYSTEM event, and the "Hoje" badge.

~~**Not reached**: outcome questions, the offline queue drain, roteiro,
cancellation, the notes composer, working hours.~~ All driven on 2026-08-16;
see §7.

### 6. Where the earlier audit stopped

Covered by reading: month view, day grid, overlap layout, role scoping, taps,
the editor's date bounds and recurrence validation, the slot picker.

**Driven on the iPhone 17** and now working: cancelling an occurrence, the
409/conflict path both client- and server-side, the notes composer, dragging a
block by its middle, "Mais opções" end to end, the speed dial, creating a
weekly series, and reaching both "Editar ocorrência" and "Editar toda a série".

Eight defects came out of that pass; see the commits from `4f310dc6` on. The
one that mattered most was a hard crash on **every** cancellation — an inline
dialog disposing its controller while the route was still animating out. No
test saw it; the app went to a red screen on the first press.

**Still not driven**: saving a series edit and confirming it moves every future
occurrence (the screen opens and reads correctly; the write was not exercised),
cancelling a whole series, and the month view's own controls.

~~**Noticed, not acted on**~~ — all four were done on 2026-08-16; see §7.

---

### 7. The second sweep (2026-08-16)

Everything §5 listed as *not reached* has now been driven on the iPhone 17
against the restored book, with every write checked in Postgres: the two
outcome questions, the offline queue drain, roteiro generation and saving,
cancellation of an occurrence and of a whole series, the notes composer, and
working hours.

**Six defects, three of them on paths a rep uses every day.**

- **A finished visit was drawn as long as it was booked.** An arrival's
  60-minute placeholder meant three improvised visits five minutes apart drew
  as three overlapping hours. Fixed in the renderer (`drawnExtent`), not the
  data: COMPLETED draws `actualStartedAt`/`actualEndedAt`, everything else
  keeps the plan, and the gap between them stays measurable (§15.6.3). The
  interaction screen had the same defect and now leads with the measured span,
  keeping "previsto 08:00–09:00" underneath.
- **Today's agenda was pinned in memory.** "Meus compromissos hoje" watches the
  same provider key as the day screen and Desempenho never leaves the tree, so
  the autoDispose family never disposed. The day screen insisted on two
  appointments across a back-and-forth, an app switch and a relaunch while the
  server returned four. Desempenho's pull-to-refresh now invalidates the agenda
  and the day screen has a refresh button.
- **Editing a series of visits had no way in.** The day grid's action sheet
  intercepts every tap on an interaction and offered only Cheguei, Encerrar and
  Abrir detalhes, so the occurrence-vs-series chooser — and with it cancelling a
  weekly series — was unreachable. The sheet now offers Editar while the visit
  is still a plan.
- **Saving a roteiro twice for the same day returned a 500.** The partial unique
  index covers DRAFT and CONFIRMED; `createDraft` superseded only DRAFT.
  Superseding a confirmed one then failed `roteiros_confirmed_metadata_check`,
  an equality that made SUPERSEDED unreachable from CONFIRMED. Migration 0123
  relaxes it to an implication, so the row keeps its `confirmed_at`.
- **The saved roteiro came back stripped.** `save()` returned the confirm
  response — the stored row — so five approved cards became five reading
  "Clínica" with no distances and "0 min" of travel. Confirm is now called for
  its effect; the day shown afterwards is the day that was planned.
- **The save could drop a stop and say nothing.** Saving re-plans server-side
  with the rep's overrides, so a three-hour visit pushed the day past working
  hours and the engine dropped a clinic — five approved, four written, and the
  app still said "sua agenda foi montada". It now names how many did not fit and
  stays on the screen.

**The four "noticed, not acted on" items are done.** `flutter_localizations`
and a pt-BR locale replace the English Material pickers (and the last two
`showTimePicker` callers now use the house wheel); choosing a clinic titles the
appointment in both the quick sheet and the editor; Desempenho's "médicos"
counted every person linked to a clinic and now joins
`person_healthcare_profiles` (146/184, matching Perfil); Perfil's territory
caption was a mockup string and now shows the rep's own territories. The
imported *"Nenhuma observação registrada!"* rows are filtered on read, with
`packages/database/scripts/purge-imported-empty-facility-notes.sql` for when
somebody decides they should be gone.

**Verified working, end to end against Postgres**: Cheguei from the Desempenho
card and from the day grid; Encerrar closing MEASURED with a `visits` row; the
two outcome questions saving `VAI_AVALIAR` + `DIAS_30`; the offline queue
holding two presses with no server and draining with the *press* instant
(06:57:36) against a lifecycle event 94 seconds later, the duplicate refused
rather than retried; cancelling a weekly series taking the calendar row and all
three occurrences with its reason; roteiro generation with its notices, the
duration ripple and the working-hours overrun warning; saving five visits into
the agenda; the notes composer; and working hours stored at 09:25 from the wheel.

**Still worth a look, deliberately not changed:**

- The engine places visits at second precision (`14:05:06`), while the rest of
  the calendar snaps to half hours and the wheel picker steps by five minutes.
  A rep who edits a roteiro-made visit will nudge it by a minute without meaning
  to. Changing it would change route packing, so it is a product call.

---

### 8. Dragging, the quick sheet, and Perfil (2026-08-16, later)

**The day grid's drag was broken in both directions**, and no widget test
existed for any of it — the geometry functions were correct the whole time and
the bug lived entirely in how the widget fed them.

- *Moving did nothing unless you flicked.* The grid handed `moveDraft` one
  frame's delta at a time and `moveDraft` snaps to a half hour, so a frame of an
  ordinary drag — two to seven pixels, two to seven minutes — rounded to nothing
  and was thrown away. Only a flick covering sixteen pixels between two frames
  moved the block at all.
- *Resizing amplified.* The handle read `details.localPosition`, the finger's
  offset inside the handle's own box — but that box is positioned by the value
  being dragged, and Flutter keeps the transform captured at touch-down, so each
  frame re-added growth already applied. A 32px pull on the bottom edge
  stretched an hour into three.
- *Half of each handle was dead.* They sat at `left: -_handleTouchRadius / 2`,
  straddling the block's edge, and a box has to be inside its Stack to be hit.

Both gestures now measure position against an anchor captured on drag start,
with `DragStartBehavior.down` so the touch slop is inside the measurement.
`agenda_day_grid_drag_test.dart` drives the real gestures in frame-sized steps;
three of its five tests fail against the old move code and one against the old
handle code.

**The quick sheet lost "Mais opções" and gained Repetição.** The button existed
for one field — everything else the full editor offers is either on the sheet
already or decided by the block that was dragged — and paid for it by opening a
second form over a block the rep had just placed. Modality went with it: a visit
drawn on the grid saves as Presencial, and a remote one is made through the
speed dial or edited afterwards.

**Perfil was mostly decoration.** A hand-painted map — a polygon of no
particular place, eight clinic pins at fixed fractions of the box, a green dot
for the rep that never moved — sat under the heading "Território" looking like a
view of their own patch. `since` was a string that defaulted to empty and
nothing filled in. `avatarHue` was read by nobody. All gone.

Território and Resumo rápido went too, at the user's call: both reported what
Desempenho reports, from a second query, which is how the two came to disagree
about the same book. Perfil is now Conta, Preferências and sair.

What it gained is real and editable: **the name**, through `PATCH /user`
(`firstName`/`lastName` — the only fields anyone may change about themselves,
and nothing in the app had ever called it), plus e-mail, telephone and username
shown read-only with a line saying an administrator changes them. Verified on
device: renaming moved the header, the initials and `users.last_name`.

**And the one that was costing every rep an hour a day.** The working-hours
sheet asked when lunch *starts* and never how long it lasts. Worse,
`findWorkingHours` ran the stored value through `Number()` — and `Number(null)`
is a finite zero that passes a `>= 0 && <= 240` range check, so a rep who had
never chosen reported a break of *no minutes*,
`hours.lunchMinutes ?? linhaParams.lunchMinutes` never fired, and the linha's
own 60-minute default **has never applied to anybody**. Every generated day
planned visits straight through lunch. `tsc` could not see it: the types were
right and the value was wrong. Superseded by §9, which removes the fields
entirely — but worth reading, because it is the clearest example in this
codebase of a defect that only a real database shows.

---

### 9. Lunch is a calendar block (2026-08-16, later still)

Prompted by a good question: *why is lunch a preference at all, when the rep
already has a calendar?*

It should not be, and the engine already agreed. `buildSchedule` pushes **every**
occurrence into `busy` and only the *fixed points* filter by facility — so a
personal block holds the clock without anchoring the route, which is exactly a
lunch break. A daily "Almoço" block was already being planned around by code
that had been there the whole time.

The preference could only say one time for every day, could not be moved when a
morning overran, could not be skipped, and was invisible on the agenda the rep
was looking at. All of that is free with a block.

**Removed**: `lunchStart`/`lunchMinutes` from the zod schema, the Elysia body,
`RoteiroParams`, `RepWorkingHours`, the working-hours sheet, and the
`roteiro_params` columns (migration 0125). With them went the linha's 12:00/60
default — which the `Number(null)` bug above meant had never reached a rep
anyway.

**The trade, stated plainly**: nobody now gets a lunch they did not ask for. A
rep with no block is planned straight through midday. That was the explicit
choice — the calendar shows exactly what is true — and the alternative
considered was seeding a block on first roteiro. A test asserts the new
behaviour rather than leaving it implied.

**Added**: `WEEKDAYS` to the calendar recurrence (migration 0124), so the block
can be Monday to Friday. Expansion counts in weekdays and converts back to
calendar days; a weekend anchor starts on the following Monday, since every
other recurrence has occurrence zero on the anchor date and this is the one that
cannot. The two index estimates lean in opposite directions deliberately — one
is only walked down, the other only up — and the tests cover a range months from
the anchor, which is where a lean the wrong way would show up.

Verified against Postgres: a WEEKDAYS block at 12:00 materialises Mon–Fri and
not at the weekend, and a generated day ran 08:35, 09:38, 10:46, then jumped to
13:00 — the end of the block.

---

### 10. The day's budget, the missing break, and what comes next (2026-08-16, last)

Spec §15.7 has the design; this is what was driven and what is left.

**The lunch block was driven end to end on the iPhone 17**, every write checked
in Postgres. Moving one occurrence wrote an override keyed to the *original*
12:00 slot with the new 13:00 time, leaving the series alone; cancelling one
wrote a second override with its reason; cancelling the series set
`calendar.status = CANCELLED` v2 and left both overrides as history. The block
was then re-created from the app — the recurrence sheet offers *De segunda a
sexta*, and the month view shows it Mon–Fri with the weekends blank.

Then the engine, per day, against the real book:

| day | state of the block | plan |
|---|---|---|
| 17 Aug | moved to 13:00 | five stops 08:07 → **12:59**, stopping dead before it |
| 18 Aug | that occurrence cancelled | no notice, **11:18–12:18 across noon** |
| 19 Aug | series still live | 10:10, then jumps to **13:00** |
| 21, 24 Aug | re-created block | same jump — a Thursday anchor expands to Friday and Monday |

**Two changes came out of it**, both committed with tests that fail against the
old code:

- **`dailyLimit` counts booked clinics** (§15.7.1). Two booked calls today →
  three suggestions, `DAY_BUDGET` explaining the subtraction, `slotCount`
  following so the workspace shows three slots.
- **`NO_BREAK`** (§15.7.2), fired only when the day covers 12:00–13:00 and no
  personal block overlaps 11:00–14:00.

⚠️ **And a defect the first of those introduced**, worth reading as a pattern:
the shortlist is `limit × 4`, so subtracting the budget from the limit shrank
the candidate *pool* along with the day. It took a measurement to see —
`QUOTA_UNFILLED` for PROSPECTAR on 16 Aug, which vanished once the pool was
restored, because the quota had been unfillable only from the cut. A change to
a number is never local when other things are derived from it.

**Not defects, noticed while driving:**

- Editing the *series* lists its own moved occurrence as `ocupado`, so a rep who
  moved one day and then edits the series is blocked from that time by their own
  exception.
- Leaving an occurrence editor always asks *"Descartar rascunho?"*, even when
  nothing was touched — the guard keys off `isSaved`, not off the draft
  differing from what was loaded.
- The screenshot-to-point factor on this simulator is **0.4374 on both axes**. A
  wrong vertical factor made a working cancel button look like a silently
  failing one for several attempts.

**Next, in order**, all four now specified in §15.7:

1. **Contacts with a doctor** (§15.7.5) — migration first: `person_id` added,
   `facility_id` nullable, at least one present, `IN_PERSON` still requires a
   facility. Then capture in the app, then the scope rule (a person who works at
   a clinic in the rep's scope).
2. **The relationship-activity merit component** (§15.7.5) — a bonus, never a
   veto: no cooldown from a doctor contact, a small decaying lift on that
   doctor's clinics, weighted by the outcome.
3. **One clinic for one slot** (§15.7.4) — the same `gain` against a single gap,
   replacing a name search that ranks by nothing.
4. **Second-precision placement** (§15.7.6) — measured at +16 min/day for
   ceiling-to-5. Still the user's call.

---

## Two habits worth keeping

**Measure before designing.** It overturned the initial merit weights, inverted
the bucket quotas, recalibrated the travel fallback, and repeatedly showed that
the thing being defended did not exist — `visits` empty, `cooldown_days` dead,
`AgendaScreen` orphaned.

**Re-read a fix against the code it touches.** Two defects this session were
introduced by the commit immediately before them: a correction stamped
`MEASURED`, and a coverage tie-break that left the SQL and the selector sorting
on different clocks.
