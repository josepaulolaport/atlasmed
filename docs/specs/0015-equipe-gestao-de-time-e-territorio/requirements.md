# Spec 0015 — Equipe as team & territory management

**Status:** Specified (2026-08-14)
**Depends on:** spec 0009 (territory & clinic ownership), spec 0010 (verticals), spec 0014
(Desempenho & Equipe)
**Amends:** spec 0014 §6

---

## 1. Context

Spec 0014 built Equipe as a roster of metrics, and §8.5 widened every row to carry clínicas,
cobertura, cadastro and pedidos at once. Driven on device, it is still a scoreboard: every
figure on it is a property of the **territory**, not of the **person**. It tells you which
patch is biggest and almost nothing about who covers what, or what to do about it.

Meanwhile territory management lives in `Territórios` — a full-screen editor whose rep filter
deliberately shows **one rep's patches at a time** (spec 0006). It answers "where is this
polygon", not "how is my region staffed".

The two halves belong together. This spec makes Equipe the **people ↔ territory** surface:
who covers what, which clinics they hold, and the edits that change either. `Territórios`
remains the geometry-first tool.

**Division of labour.** Equipe answers *who*; Desempenho answers *how much*; Territórios
answers *where*. Every screen here links out rather than reproducing a smaller version of the
other two.

---

## 2. Screens

```
Equipe (roster)
└── Membro (read-only profile)
    ├── Desempenho          → spec 0014 subject dashboard
    ├── Clínicas associadas → Explorar, filtered
    │   └── ⋯ Ver clínica | Desassociar
    ├── Associar nova clínica (REP subjects only)
    │   ├── inside patch  — geofiltered, no reason
    │   └── outra clínica — any clinic, reason required
    ├── Minimapa → fullscreen map (view + edit)
    └── Reps under this manager (ADMIN viewing a MANAGER)
```

Roster membership is unchanged from 0014 §6: a MANAGER sees their reps; ADMIN and OPS see
managers and drill into one manager's team.

---

## 3. Scope — a manager sees their share of a person

**The rule: Equipe shows you the part of a person you are accountable for.**

I4 places each patch inside exactly one manager zone, but nothing stops a rep holding patches
under two managers. Today no rep does — every one of the five holds a single patch — so the
current roster is correct by accident, not by construction.

### 3.1 Roster — R1

`assigned_clinic_count` and all four batched metrics must be scoped to the viewing manager's
zones, joining the profile through `manager_zone_id ∈ zoneIds`.

Unscoped, a manager is shown clinics they cannot act on, and their header stops reconciling
with the rows beneath it the day any rep picks up a patch elsewhere. Scoped, the identity
holds by construction: **the manager's own totals equal the sum of their reps' rows.**

### 3.2 Desempenho carry-through — R2

`resolveDenominator` currently returns `{kind: "rep", userId}` for a rep subject — every clinic
that person holds anywhere. A scoped roster feeding an unscoped dashboard means tapping a row
silently changes the population.

`DashboardDenominator`'s rep variant gains `withinZoneIds`, which `buildProfileFilter` ANDs into
`filter.zoneIds`.

The constraint is **derived from the viewer, never accepted from the request**, so a manager
cannot widen their own scope by asking:

| Viewer | Constraint |
|---|---|
| MANAGER | their own zones |
| ADMIN / OPS | `withinManagerId` when the subject was reached through a manager's team; otherwise none |

`withinManagerId` exists so an admin drilling Equipe → gestor → representante keeps reading the
population the roster row showed.

**AC:** a rep holding patches under two managers reads differently to each of them, and the sum
of a manager's rep rows equals that manager's own row.

### 3.3 OPS — R3

OPS sees every screen in this spec read-only. No associar, no desassociar, no geometry editing.
OPS cannot hold a territory (spec 0010 §2.3), so it has no denominator of its own.

---

## 4. Member profile

Read-only. Identity edits stay in `Usuários`; only territory and assignments are mutable here,
and only through their own controls.

### 4.1 Fields — R4

Nome · avatar · e-mail · telefone · função · status da conta · membro desde.

**Excluded:** `birth_date` — personal, no operational use.

**Último acesso.** `sessions.last_seen_at` **was** already maintained by the auth plugin on a
5-minute throttle — an earlier draft of this spec said it was written once at session creation
and never updated, which was wrong. What was wrong with it is subtler: *every* authenticated
request moved it, and the session token refreshes on an 8-minute timer, so a phone left
untouched reported its owner as active forever.

The client now marks requests that follow a real interaction (`X-Client-Activity`), and only
those move the timestamp. It is client-declared on purpose: this is telemetry about our own
reps rather than an authorisation input, and a build that never sends the header simply stops
moving the field instead of silently reporting timer traffic as activity.

Throttled against the session already in memory rather than a Redis key, which removes a
round-trip from every authenticated request in the app. Two instances writing at once is
harmless — near-identical timestamps, last one wins.

It answers "is this account being used", never "is this person working". That is fieldwork.

**Not included:** field activity (visitas no mês, última visita, visitas não realizadas). The
data is indexed per user and would answer "is this person working", which nothing else does —
but the visits module is still being built and this spec will not depend on it.

### 4.2 Cards — R5

- **Desempenho →** the spec 0014 subject dashboard, carrying §3.2's scope.
- **Clínicas associadas (n) →** Explorar filtered to that person's clinics, same scope as the
  count. Each row carries a `⋯` menu: **Ver clínica** · **Desassociar**.
- **Clínicas fora do território (n)** — active assignments carrying an override (§5.2).
  `GET /facilities/out-of-territory-assignments` already implements spec 0009 R2's report,
  vertical-scoped and paged; it gains a `userId` filter here so the card can open one
  person's. What was missing was never the query — only a screen that shows it. The count on
  the profile scans by `user_id`, since the partial index
  `facility_vertical_rep_assignments_override_idx` is keyed on `override_by_user_id` (who
  waived) rather than on who holds the clinic.
- **Reps under this manager** — ADMIN viewing a MANAGER only. Small sequential cards into each
  rep's profile.

---

## 5. Assignment

### 5.1 Associar nova clínica — R6

REP subjects only. Two doors:

**Inside the patch (default).** Unassigned clinics geometrically covered by that rep's patches
*within the viewer's zones*. Tap → confirm → assigned. No reason required.

Membership is resolved by `ST_Covers` **at request time**. Patch membership is deliberately not
materialised: unlike `manager_zone_id`, which every dashboard metric filters on, this is a cold
path reached only when someone opens the screen, and a derived column would have to stay
correct through every patch edit. `public.facilities` holds ~1.4k rows and CNES imports land in
the `registry` schema, so there is no scale argument for materialising. If that changes, adding
`patch_id` later is not blocked by anything here.

**Outra clínica.** Searches the whole vertical and **requires a reason**. This is spec 0009 R2's
override: I2 is satisfied by patch coverage **or** an explicit reason, and
`AssignFacilityVerticalRepUseCase` already implements both paths, recording
`override_reason` + `override_by_user_id` under a check constraint that keeps them together.

Refusing out-of-patch assignment is not an option. The use case's own comment names the failure
it would cause: a throwaway patch drawn around the clinic, which makes the territory model lie
permanently to work around a one-off. Whoever may assign may override — R2 is about
reportability, not gating.

Overridden assignments are excluded from de-assignment sweeps and from boundary-impact sets, so
they survive geometry edits. That stickiness is why the second door demands a deliberate gesture
and a sentence.

**Takeover.** A clinic already held by another rep may be assigned from either door; `assign`
ends the previous assignment and returns `previousUserId`. The confirmation must name the
current holder.

**Optional:** *Ver no mapa* — the rep's patch outlines with the free clinics inside them.

### 5.2 Desassociar — R7

From the `⋯` menu on the clinics list. I5 forbids deletion: the assignment is ended with
`ended_at`, an `end_reason` from a fixed list of motivos, an optional note, and
`ended_by_user_id`.

A fixed list rather than free text, because churn that cannot be aggregated cannot be explained
later.

**The mutation must be authorised server-side**, not merely hidden. A manager must not end an
assignment outside their own zones just because a list showed it to them.

---

## 6. Map

### 6.1 Minimapa — R8

On the member profile: the viewer's zone outlined, the subject's patches inside it shaded,
everything outside greyed. A patch held under another manager falls outside the grey and is
invisible by construction — the map must not draw a polygon the viewer would tap and then be
refused.

### 6.2 Fullscreen — R9

| Viewer | Subject | Outline | Shaded | Editable |
|---|---|---|---|---|
| MANAGER | REP | their own zone | that rep's patches | the patches |
| ADMIN | MANAGER | — | every other manager's zone (taken) | that manager's zone |
| ADMIN | REP via a manager | that manager's zone | that rep's patches | the patches |

Uncovered ground renders as plain map — it is unclaimed, not forbidden.

An admin reaching a rep through a manager's team gets the **manager-context** view: they are
inspecting that team, and should see the rep as that manager does.

### 6.3 Editing — R10

Reuses the Territórios editor: drawing, snapping, territory-type rules, the boundary-impact
sheet, and save. Creating a territory and assigning it to the subject happens here too.

**Zones snap, they never take.** I3 forbids overlap, so a zone grows only into unclaimed ground
and snaps to its neighbours' edges. There is no two-sided edit and no manager loses ground
without acting. Zones may therefore leave gaps, and clinics in a gap have no
`manager_zone_id` — the zone-level counterpart of "clínicas sem representante", which has no
home yet and is out of scope here.

**Atomicity is already correct.** Spec 0009 R1 was fixed: `saveBoundary` runs in one
transaction, locks the row, re-reads under the lock, validates geometry → containment → sibling
overlap before touching any assignment, recomputes the impact set server-side and rejects a
stale `acceptedFacilityIds`, then de-assigns last and recomputes membership in the same
transaction. This also closes the concurrency risk of a client's accepted list going stale
between preview and save.

**The impact sheet should group by rep**, not list clinics. Shrinking a zone that de-assigns 40
clinics across 3 reps currently reads as 40 names; *"Mauro Araujo perde 28 · Flavio Ramalho
perde 12"* is the decision actually being made. `end_reason = "boundary_impact"` and
`ended_by_user_id` are already recorded, so the affected manager can trace who did it.

---

## 7. People who are not on the roster

### 7.1 Pending invites — R11

The roster is `users INNER JOIN user_territory_assignments`, so an invited rep is invisible —
you invite someone, draw their patch, and Equipe shows nothing, while the clinics in that patch
are effectively unstaffed.

Invitations stage their territory in `invitation_territory_assignments`, so a pending rep does
belong to a zone and can be placed on the right manager's roster: a greyed row, chip **convite
pendente**, no metrics. Tapping shows the staged patch, with resend and revoke.

A roster row rather than a separate band — the point is that they already occupy territory.

### 7.2 Reps who lose their patch — R12

The manager link is territory-derived; `users.manager_id` was dropped in migration 0044 (spec
0009 R9). **A rep with no patch therefore has no manager at all** — "your reps without
território" is not a set that can exist, which is why `GET /team/reps-without-patch` is global
and ADMIN-only.

The hazard is that deleting or deactivating a patch drops that rep out of their manager's team
silently, and only an admin can find them again. Deletion must warn at the moment the
information exists:

> Mauro Araujo ficará sem território e sairá da equipe de Silvio Vieira.

---

## 8. Freshness — R13

The roster counts, the minimap, the clinics list and Desempenho all derive from the same
assignments and geometry. Every mutation in this spec — assign, unassign, boundary save,
territory create or delete — must invalidate all of them.

This is a correctness requirement, not polish. Spec 0014 §8.4 records a scope cached at
`scope:user:<id>` that kept a stale shape after the fix that corrected it, and two fixes looked
unapplied until the key was dropped. This design has four surfaces reading one fact.

---

## 9. Acceptance criteria

1. A rep holding patches under two managers reads differently to each; each manager's own
   totals equal the sum of their rep rows.
2. Tapping a roster row opens a Desempenho whose population matches the row's figures — for a
   manager, and for an admin drilled through a manager.
3. A manager cannot end an assignment outside their zones, enforced server-side, not by hiding
   the control.
4. Assigning inside a patch records no override; assigning outside records reason and author,
   and the assignment survives a boundary edit that would otherwise end it.
5. Assigning a clinic already held names the current holder before confirming.
6. Shrinking a zone shows affected reps grouped by person, and a validation failure leaves every
   assignment intact.
7. A pending invite with a staged patch appears on the right manager's roster and cannot be
   confused with an active member.
8. Deleting a patch warns which rep leaves which team.
9. After any mutation, no surface shows a pre-mutation figure.

---

## 10. Out of scope

Everything R1–R13 specifies is built. What remains out of scope is unchanged in
kind: these are things this spec deliberately does not answer.


- **Field activity on the profile** — pending the visits module (§4.1).
- **Whether Territórios stays visible to managers.** If it is hidden, this map becomes their
  only way to draw a patch and must carry the full editor. Deferred deliberately.
- **Uncovered ground as a zone-level report** (§6.3).
- **Zone-level "clínicas sem gestor"**, the counterpart to clínicas sem representante.
