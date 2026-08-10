# ADR 0008 — The store is the authority, and there is no per-file worker

**Status:** Accepted · **Date:** 2026-08-10
**Amends:** spec 0011 §2 (which keeps a Temporal verify step), §3.3 (which revives
`EXPIRING_SOON`), §5 (review-queue scoping) and §6 (retention vocabulary).
**Builds on:** ADR 0007 — the document is the unit.

## Context

Spec 0011 diagnosed the cadastro pipeline correctly and then, in one place, prescribed a fix
larger than the problem. Its §2 keeps a Temporal workflow whose only remaining job is to verify an
upload — but the same section removes hashing, thumbnails and previews, so "verify" reduces to a
single `HEAD` against the object store.

Meanwhile the two structural defects it names are real and still live:

- **Processing runs on the request thread** (`cadastro-submission.use-cases.ts:610`), bounded by
  the client's timeout. iOS gives up at 60 s while the server marks `READY`, so the rep uploads
  again.
- **The client is the authority on whether an upload happened.** It PUTs, it calls
  `/uploads/complete`, and the API believes it. A client that dies in between leaves an object in
  storage that the database never learns about.

A third followed from the first: the Temporal workflow *also* still runs, so two writers race on
one `file_assets` row, and the workflow's failure is swallowed by a bare `catch {}`.

Phase 3 was planned before ADR 0007 deleted the cadastro package. Re-reading it against the code
that actually shipped, several items had already been closed by #199/#202 and one had shrunk.

## Decisions

### 1. `HEAD` in the request; delete the per-file workflow

`/uploads/complete` asks the store whether the object exists, and how big it is and of what type.
The store's answer is authoritative; the client merely triggers the question. On success the file
is `READY`; on absence or mismatch, `FAILED`.

**`cadastro-file-uploaded.workflow.ts` and its activities are deleted.** With no hashing and no
derivatives there is nothing left to do asynchronously — a `HEAD` is one fast call, not the
processing that justified a queue. Deleting it also removes the two-writers race by construction
rather than by coordinating them.

*Deviates from spec §2*, which keeps the worker "so expiry re-checks and future processing have
somewhere to live". That is speculative generalisation: expiry re-checks are a scheduled sweep,
not a per-file workflow, and the sweep is decision 2. ADR 0007's precedent applies — the safest
version of a layer nothing consumes is the one that does not exist.

**Consequence accepted:** if `HEAD` is slow, the rep waits for it. A `HEAD` transfers no bytes and
runs against the same store the client just wrote to; if it is slow, the upload was too.

### 2. The sweep is a Temporal schedule

Orphan reconciliation (P3-3) and, later, the retention purge (P3-7) run as a scheduled workflow on
the existing `atlasmed-workflows` queue. The worker stays; only the per-file workflow goes.

Reuses infrastructure already proven in production — the Emultec schedule fires on time every ten
minutes — plus the self-provisioning schedules and admin endpoints from #190, and runs are
visible in the Temporal UI. An in-process `setInterval` was rejected: it runs once per replica,
dies silently with the process, and leaves no run history.

**The sweep covers every non-terminal state.** Today `INCOMPLETE_UPLOAD_STATUSES` is
`PENDING_UPLOAD` and `UPLOADING` only, so a redeploy mid-request strands a file in `PROCESSING`
forever with no UI to clear it (D-14). The comment at `:96` records that this class of bug already
reached production once and the fix stopped one status short.

### 3. MANAGER loses the cadastro review screen

Cadastro review is back-office work. **OPS and ADMIN only.**

`MANAGER` currently holds `read` and `update` on `CADASTRO_SUBMISSION`
(`role.permissions.ts:54-55`); both are revoked. The nav gate at `ui.permissions.ts:102` reads the
same ability, so the screen disappears with the grant — one change, both effects. REP is already
denied explicitly.

The queue is **also** facility-scoped, for the roles that keep it: it never called
`assertResourceInScope`, so every reviewer saw every territory (D-07). ADMIN is global and stays
global; a scoped OPS user sees only their facilities.

### 4. Expiry is derived per document, never stored

`conformity_requirements.requires_validity_date` declares whether a validity applies;
`submission_documents.valid_until` stores the date. **The warning is computed at read time.**

`EXPIRING_SOON` is *not* revived on `conformity_status`. A status that must be rewritten daily is
a second source of truth for a fact the date already carries, and the job that rewrites it is one
more thing that can stop silently. Migration `0081` removed the value; it stays removed.

**Scope limit, deliberate:** the warning appears on the *document* in the cadastro screen. The
clinic-level status in Explorar is untouched and expiry does not feed it — deriving a per-clinic
expiry state would mean evaluating every document of every clinic inside the list query and its
"Status" filter. Revisit only if that filter is actually wanted.

### 5. Retention purges files, keeps documents

| state | policy |
|---|---|
| draft file removed or replaced before submit | delete immediately |
| upload never completed / orphaned | swept and deleted |
| REJECTED / SUPERSEDED | **files** deleted after 1 week |
| APPROVED | never deleted |

The `submission_documents` row survives a purge with its status, version, reviewer comment and
timestamps — the history of *what was rejected and why* is the part worth keeping, and it costs
nothing. Only the bytes and their `file_assets` rows go. A purged attempt still renders as
"v2 — Reprovado — <comment>", with no files to open.

Mechanism: `purge_after` on `file_assets`, applied by the sweep in decision 2. Object-lifecycle
rules cannot see submission state, so the application must drive it.

### 6. `valid_until` is entered by the rep and confirmed by the reviewer

The rep supplies it at submit, only where the requirement declares one. The reviewer confirms or
corrects it while approving. Two people see a date that drives a compliance warning; the rep is
holding the document and the reviewer is already opening the file.

### 7. Lane B owns the API and the mobile client

Cadastro is the feature where the two are most tightly coupled — the states, the limits, the poll
loop. Splitting them across lanes would mean writing the contract down precisely enough to hand
over, and drift is the failure mode.

**Order: contract first.** P3-2 redefines what `/uploads/complete` means, so the Flutter client is
written once, against the final shape, rather than twice.

## Corrections to spec 0011

Checked against the code, not against the spec's own claims.

**P3-1 is nearly done.** #199 and #202 landed the boot gate (`server.ts:15`), removed the silent
`atlasmed-minio` fallback, clamped presign TTL to R2's 7-day ceiling, moved client construction
into `@atlasmed/storage` so the API and worker cannot drift, and stopped the bucket-provisioning
crash-loop. `headObject` already exists. One real bug remains: **part URLs are signed for 1 hour
against a 6-hour session**, so a slow multipart upload gets `403 SignatureDoesNotMatch` after the
bytes are already moving.

**D-13 (ETag) appears not to be a defect.** The spec says `response.headers['ETag']` is
unreachable because Dart lowercases header keys, leaving `''`. The code reads
`response.headers['etag'] ?? response.headers['ETag'] ?? ''` — lowercase *first*, which is exactly
the key Dart produces, and `git log -S` shows it that way since #110. Reproduce a failure before
spending time on it.

**§6 still speaks of packages** — "SUPERSEDED packages", "versions packages". After ADR 0007 those
are per-document versions. The policy holds; the vocabulary is stale.

## Consequences

**Better.** One writer per row. A client that dies mid-upload no longer produces a permanent
orphan, because the sweep reconciles against the store. Rejecting a document no longer needs a
transaction because there is no clone (ADR 0007). One fewer workflow to deploy, monitor and
version.

**Worse.** No async seam for future per-file work — reintroducing one means reintroducing a
workflow. Accepted: the sweep is the seam, and it is scheduled rather than per-file.

**Unresolved.** Whether OPS should be territory-scoped rather than global is deferred; today OPS
is global by role. If regional OPS teams appear, this needs revisiting, and a facility outside
every OPS user's scope would otherwise have its documents reviewed by nobody.
