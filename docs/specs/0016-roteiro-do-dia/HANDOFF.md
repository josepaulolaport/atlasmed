# Roteiro do dia — handoff

Branch `feature/roteiro-do-dia-p1-20260815`, 58 commits ahead of `main`, tree
clean and pushed. Last commit `831f1073`.

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

`visits` is empty; every interaction is `SCHEDULED`. No rep has pressed
*Iniciar interação*, and no rep has seen a generated slate. Everything above was
validated against a database and a simulator by the agent alone. The riskiest
assumption in the feature — that reps want it in this shape — is untested.

Note what this gates: aderência, conversão and validated potential (the rest of
P5) are all waiting on usage, not on code.

### 3. ~~Three places disagree about when a rep works~~ — done

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
- **Offline stamping — half done.** The correctness half is built: start,
  complete and arrival accept an instant from the device, and
  `resolveClientInstant` decides whether to believe it (absent means now, small
  skew is clamped, the future and anything over a day old are refused). Verified
  against Postgres: a 90-minute-old arrival anchors to the hour the rep was
  there and a completion an hour later reports 60 minutes, not the queue's
  latency.

  **There is still no offline queue.** Nothing is recorded offline yet — the
  request simply fails, which is the spec's other permitted answer. What exists
  now is the contract that makes a queue correct when it is built: persisting
  requests, replaying them, and showing the rep what is still pending.
- **Push reminder with an "Iniciar" action.** `firebase_messaging` is absent,
  there is no device-token store, and nothing reads `pushNotificationsEnabled`.
- **Geofence arrival/exit.** `geolocator` is one-shot and foreground, permission
  is When-In-Use, no background mode declared.

### 5. Where the audit stopped

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

**Noticed, not acted on** — these are yours to call:

- `facility_notes` carries 1,445 rows reading *"Nenhuma observação registrada!"*,
  one per clinic, bulk-inserted. They render as real notes beside real ones.
  The string is nowhere in the repo, so it came in with the data.
- `showTimePicker` in `working_hours_sheet.dart` renders in **English**
  ("Select time", "Cancel", "OK"). The editor's pickers pass explicit pt-BR
  labels and read correctly, so the app has no Material localization delegate
  and each caller is papering over it.
- The quick sheet demands a typed title even once a clinic is chosen, while the
  editor auto-titles *"Visita · <clinic>"* from the same choice.
- Perfil reports 184 médicos and "São Paulo · Zona Oeste"; Desempenho reports
  214 and "Patch Adriana Oliveira" over Rio. Same rep, same session.

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
