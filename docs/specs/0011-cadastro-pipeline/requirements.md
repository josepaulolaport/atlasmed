# Spec 0011 — Cadastro: upload pipeline, review & retention

**Status:** Accepted (2026-08-10) · **Supersedes:** `docs/specs/0004-cadastro-submissions/design.md`

That document is wrong on states (documents 4 vs 9 real enum values; `SUBMITTED` never written),
on processing location (claims a Temporal workflow; it runs **inline in the API request**), on
endpoint count (8 vs 13), and claims "bytes never stream through the Bun API" when they do,
twice. Do not read it as current.

---

## 1. Diagnosis

The schema was designed well — `file_assets` / `document_files` / `upload_sessions` /
`upload_parts` / `review_decisions` / `processing_events`, presigned direct-to-storage upload,
split internal/public S3 endpoints, multipart tracked in the DB. That is the right system.

**One decision broke it.** `cadastro-submission.use-cases.ts:625`:

> *"Process inline so READY does not depend on a running Temporal worker."*

A real operational worry answered by moving work onto the request thread instead of making the
async path reliable. Everything else follows: upload latency bounded by processing (iOS 60 s
timeout ⇒ client marks FAILED while the server marks READY ⇒ duplicate uploads); a Temporal
worker that still runs ⇒ **two writers on one row**; its failure swallowed by a bare `catch {}`;
`PROCESSING` entered on the request path with no sweep ⇒ files stranded forever.

**Second structural error: the client is the authority on whether an upload happened.**
Client PUTs → client calls `/uploads/complete` → the API believes it. If the client dies between
those steps the object exists in storage and the database never learns of it. Permanent orphan,
no reconciliation. Same root as the orphaned `file_assets` rows (D-15).

**Root cause of the reported outage (D-08):** unrelated to either — the checklist endpoint
returns `files` only for an already-APPROVED document
(`facility-cadastro.use-cases.ts:245-248`), so a fresh draft always serializes `files: []`,
`uiStatus` falls to `"missing"`, the poll loop never matches, and **"Enviar" is permanently
disabled**.

---

## 2. Target architecture

> ⚠️ **Amended by ADR 0008 (2026-08-10).** The flow below is right except for one step: there is
> no `worker → verify` stage. With hashing and derivatives removed, verification is a single
> `HEAD`, so it happens in the request that triggers it and the per-file Temporal workflow is
> deleted. The sweep stays and becomes a Temporal *schedule*. §2.1's storage-port requirements are
> almost entirely closed already by #199/#202 — see the ADR for what is left.

```
client → POST /uploads/initiate      → presigned PUT (+ multipart part URLs)
client → PUT directly to object store        (bytes never traverse the API)
client → POST /uploads/complete
API    → HEAD the object              ← THE STORE confirms existence, size, content-type
API    → mark UPLOADED, enqueue
worker → verify, mark READY | FAILED
sweep  → reconcile orphans + purge expired files
```

**The store is the authority, not the client.** The client still *triggers* the check; it is no
longer *believed*. A `HEAD` costs nothing and returns size, content-type and ETag — everything
verification needs, without transferring a byte.

**Rejected: push callbacks from the object store.** MinIO can webhook directly to the API;
R2 publishes to Cloudflare Queues, requiring a Worker to forward. That is a different topology
per environment — exactly the dev/prod divergence that produced D-56 and D-57. The `HEAD` +
sweep pair gives store-authority with identical behaviour in both, no extra infrastructure.
Push callbacks may be added later behind the same port as an optimisation, not a dependency.

**No hashing. No server-side derivatives.** The ETag from the store covers integrity; a properly
normalised client upload is already a reasonable viewing size. R2 charges no egress, so serving
originals to reviewers is free. The worker exists so expiry re-checks and future processing have
somewhere to live — not because day-one work requires it.

### 2.1 Storage port

Both R2 and MinIO are S3-compatible: one SDK, one presigned-URL flow. Differences the port must
absorb:

| | MinIO (dev) | R2 (prod) |
|---|---|---|
| `region` | any | **must be `auto`** |
| Addressing | `forcePathStyle: true` | virtual-host or path |
| Endpoint | `http://atlasmed-minio:9000` | `https://<account>.r2.cloudflarestorage.com` |
| Presign TTL ceiling | configurable | **7 days** |
| Egress | n/a | **free** |
| Event notifications | webhook | Cloudflare Queues (not used — see above) |

Requirements:
- One `StoragePort` interface; provider selected by configuration, never by branching in
  use-cases.
- **`STORAGE_BUCKET`, `STORAGE_ENDPOINT`, `STORAGE_PUBLIC_ENDPOINT` become production-required**
  in `packages/config` (D-56). Today the API boots with storage misconfigured and
  `storage.client.ts:55` **silently falls back** to the cluster-internal
  `http://atlasmed-minio:9000` — handed to phones. Fail at boot, loudly.
- `forcePathStyle` must not depend on a truthy endpoint (D-58): an empty endpoint currently
  signs virtual-host URLs against real AWS.
- Presign TTL must respect the provider ceiling; part URLs must not outlive their session
  (today: 1 h part URLs against a 6 h session ⇒ `403 SignatureDoesNotMatch` mid-upload).
- Bucket provisioning must not be startup-only and fail-fast with no prod sidecar (D-57):
  MinIO arriving late currently **crash-loops the API**.

---

## 3. Data model

### 3.1 Cadastro keys on the profile

> ⚠️ **Superseded by ADR 0007 (2026-08-10), implemented in migration `0084`.** There is no
> package to key on: `cadastro_submissions` is deleted. The **document** carries
> `facility_id` plus a nullable `facility_vertical_profile_id` (null = facility-scoped), and
> uniqueness is `(facility_id, requirement_id, version)`. The "one DRAFT per …" partial index —
> in either form — is gone, which is what closes D-16.

`FacilityCadastroCompletionService` computes per profile and writes
`facility_vertical_profiles.conformity_status` (renamed from `commercial_status`);
`facilities.conformity_status` is removed. That part stands.

**`file_assets` stays facility-scoped — deliberately.** Under §3.2 a facility-scoped requirement
is satisfied once for every profile, so the same physical object must be able to back documents
in two profiles. Documents carry the profile; files stay with the facility.

### 3.2 Requirement scoping
`conformity_requirements.vertical_id` **null = facility-scoped** (satisfied once, counts for
every profile of that facility — CNPJ card, contrato social); **non-null = vertical-scoped**.
`findActiveRequirements` must filter accordingly — it currently ignores the column entirely
(D-49).

### 3.3 Validity / expiry

> ⚠️ **Amended by ADR 0008.** `requires_validity_date` and `valid_until` stand. Reviving
> `EXPIRING_SOON` does not: the warning is **derived at read time** from `valid_until`, and only
> on the document in the cadastro screen. The clinic-level status in Explorar is untouched —
> deriving it there would mean evaluating every document of every clinic inside the list query.
- `conformity_requirements.requires_validity_date boolean` — declares whether a validity date
  applies. A CNPJ card does not expire; an alvará does.
- Document-level nullable `valid_until date`.
- The rep supplies it at submit **only where the requirement declares it**. The reviewer may
  correct it while approving. On approval it is stored with the document.
- Drives the rep-facing expiry warning and makes `conformity_status.EXPIRING_SOON` reachable —
  it is currently an unwritable enum value (D-66).

### 3.4 Attribution
`file_assets.uploaded_by_user_id` — **does not exist today**; nobody knows who uploaded anything.
Required because the draft belongs to the profile and the assigned rep, their manager and OPS can
all contribute. Set at `initiate`. Surfaced in the UI to reps and reviewers alike.

### 3.5 Columns orphaned by this spec
`thumb_object_key`, `preview_object_key`, `sha256`, and the processing outputs `page_count`,
`width`, `height`. Drop or leave nullable — decide in the migration; do not leave them populated
by nothing and read by something.

---

## 4. Upload flow

### 4.1 States
Six states collapse to three from the user's point of view: **selecionado → enviando (x %) →
enviado**. "Processando" is an implementation detail and must not be shown.

Internally `PENDING_UPLOAD → UPLOADING → UPLOADED → READY | FAILED`. `PROCESSING` becomes a
sub-second worker-owned state, and **the sweep must cover every non-terminal state** — today
`INCOMPLETE_UPLOAD_STATUSES` covers only `PENDING_UPLOAD`/`UPLOADING`, so a redeploy between
`:620` and `:627` strands a file in `PROCESSING` permanently with no UI to delete it (D-14). The
code comment at `:96-100` records that this class already hit production once and the fix stopped
one status short.

### 4.2 Client normalisation
**Stop re-encoding to PNG** (D-11). A 2 MB camera JPEG currently becomes a 6–20 MB PNG, which
pushes ordinary photos across the 10 MB multipart threshold non-deterministically and runs
`sha256` on the **UI isolate** over the inflated buffer. Downscale (≈2048 px) and encode **JPEG**.
Correct normalisation is what removes the need for server-side thumbnails.

### 4.3 Progress, retry, resume
Progress is a property of the **transfer**, unrelated to processing. `_putBytes`
(`facility_cadastro_repository.dart:356-376`) uses a bare `http.Client()`, which exposes **no
upload progress, no timeout and no retry**. Replace with a progress-capable client
(`dio.onSendProgress` or a streamed request).

Multipart gives natural granularity (part N of M) **and** resume — `upload_sessions` /
`upload_parts` exist for precisely this and nothing implements it. Fix the ETag bug first
(D-13): `response.headers['ETag']` is unreachable because Dart lowercases header keys, so the
effective fallback is `''`, which fails `minLength: 1` and 422s **after** the bytes are uploaded,
leaving an abandoned multipart nothing ever aborts.

Retry is **per file**, never per package.

### 4.4 Concurrency
`nextDocumentFilePosition` is a read-then-write with no transaction or lock against a unique
index; the loser gets a raw unique violation ⇒ 500, **and** the `file_assets` row is orphaned
with no `document_files` link, invisible to the prune (D-15). `countDocumentFiles` /
`sumDocumentFileSizes` are read-then-write too, so `maxFiles` / `maxCombinedSizeBytes` are
bypassable under concurrency.

Fix: order by creation time rather than a unique `position`, unless reordering is user-editable —
a `files/reorder` endpoint exists, so if it is kept, take a transaction plus row lock instead.

### 4.5 Two reps on one package
Only one rep holds a (facility × vertical) at a time (spec 0009 I1), so the realistic concurrent
actors are the assigned rep, their manager and OPS — collaboration, not contention.

- **The draft belongs to the profile, not the person.** A mid-cadastro rep handover just works;
  the new rep inherits the in-progress package.
- Per-file attribution (§3.4) makes the shared draft legible.
- **Optimistic concurrency on submit** — the client sends the version it last saw; a stale submit
  is rejected with a diff rather than silently submitting someone else's half-finished work.
  Same shape as `acceptedFacilityIds` in the boundary flow, which re-validates server-side.
- Duplicate files under one requirement are **allowed**; the reviewer chooses. Prevention would
  need locking this model does not want.
- **Not built:** draft locking, takeover requests.

---

## 5. Submit & review

> ⚠️ **Amended by ADR 0007 (2026-08-10).** "Delete the package-submit path" below is correct and
> goes further: the package itself is deleted. The `CHANGES_REQUESTED` clone in §6 is not wrapped
> in a transaction — it is removed, which is what actually closes D-16. Optimistic concurrency
> (§4.5) moves to the document; it was never implemented, so nothing is lost.

**Delete the package-submit path.** ✅ Done in migration `0084` — the whole package went with it.
`submitPackage` / `canSubmitPackage` were dead client code with no callers, and the two paths
enforced `requiresFrontAndBack` differently — strict at `:840-848`, lenient at `:1201-1214`. Only
the per-requirement path remains. One path, one rule.

**Scope the review queue.** `GET /cadastro/packages` is deleted (it had no consumer).
`GET /cadastro/submissions` still never calls `assertResourceInScope`; reviewers get a **global**
queue across all territories (D-07, still open).

> ⚠️ **Amended by ADR 0008.** MANAGER loses cadastro review entirely — it is back-office work, so
> **OPS and ADMIN only**. Revoking `read`/`update` on `CADASTRO_SUBMISSION` at
> `role.permissions.ts:54-55` also hides the screen, since `ui.permissions.ts:102` gates the nav on
> the same ability. The queue is facility-scoped for the roles that keep it; ADMIN stays global.

**Delete the legacy download route.** `GET /facilities/cadastro/files/*`
(`facilities.route.ts:407-432`) has `auth` only — no `requirePermission`, no scope — and its use
case structurally cannot scope-check (composition injects only the conformity repo and storage).
Mitigated by a v4-UUID storage key (a capability URL, not an enumerable IDOR) but with **no
expiry and no revocation**: anyone who ever saw the key keeps access after losing scope. The
modern per-file endpoint is correctly guarded. **(D-02)**

**Fix the audit test that missed it.** `route-security.registry.test.ts:44-48` asserts *per file*,
so one guarded route vouches for every unguarded sibling in the same file. It will pass the next
one through too. **(D-03)**

Reviewers approve or reject per document with a comment, and confirm or correct `valid_until`
where the requirement declares one.

---

## 6. Retention

> ⚠️ **Amended by ADR 0008.** Purge deletes **files only**; the `submission_documents` row is kept
> with its status, version and reviewer comment, so the history of what was rejected survives.
> Note the vocabulary below predates ADR 0007 — "packages" are per-document versions now, and the
> `CHANGES_REQUESTED` clone flagged at the end of this section no longer exists to wrap.

| State | Policy |
|---|---|
| DRAFT file removed or replaced before submit | delete immediately |
| Upload never completed / orphaned | swept and deleted (also the D-15 fix) |
| REJECTED | delete after **1 week** |
| SUPERSEDED | delete after **1 week** |
| **APPROVED** | **never deleted** |

Approved documents are the evidence a clinic was compliant at a point in time. The
`CHANGES_REQUESTED` flow already supersedes and versions packages; purging approved files would
destroy an audit trail the design deliberately keeps.

Mechanism: `purge_after` on `file_assets` + a sweep job — the same worker that reconciles
orphans. Object-lifecycle rules cannot see submission state, so the application must drive it.

⚠️ The `CHANGES_REQUESTED` clone (`:925-985`) is **not transactional** — it supersedes, creates,
then loops. A crash mid-loop leaves a superseded package plus a half-built draft, and the
partial-unique DRAFT index then rejects retries (D-16). Wrap it.

---

## 7. User stories

**Rep — submitting**

> I open **Cadastro** and see the checklist **for the linha I'm working** — each requirement
> showing Pendente / Enviado / Em análise / Aprovado / Reprovado, and *Vence em N dias* where
> relevant.
>
> I tap a requirement and see exactly what is accepted: file types, max size, how many.
> **Anything invalid is rejected instantly, before any upload** — "PDF de até 50 MB — este tem
> 62 MB". *(Today the API returns `allowedMimeTypes`, `maxFiles`, `maxFileSizeBytes`,
> `maxCombinedSizeBytes` and the client reads **none** of them, so the user learns at `initiate`,
> after waiting.)*
>
> Each file shows a **progress bar with a percentage** and a cancel button. Photos are downscaled
> automatically. If one file fails, **only that file** offers *Tentar novamente*.
>
> If I lose signal the upload **resumes where it stopped**. If I leave the screen it continues;
> fully offline it queues as *Aguardando conexão*.
>
> Where the document has a validity, I enter it. Then *Enviar para análise* — enabled as soon as
> the required files are present, **never blocked on an invisible server state**.
>
> After submitting it is read-only with a clear status. If changes are requested I see **the
> reviewer's comment** and can replace only the flagged files.
>
> Files added by my manager or by ops show **who sent them** — "Enviado por Maria · há 2h".

**Ops — reviewing**

> I open the review queue **scoped to my territory and linha**, see each document full-size
> without waiting, approve or reject with a comment, and **confirm or correct the validity date**.
> On approval it is stored with the document and drives the rep's expiry warning.

---

## 8. Acceptance criteria

1. Uploading a file to a DRAFT document returns it in the checklist response, with status —
   **the D-08 regression test.**
2. "Enviar" becomes enabled once required files are present; no polling loop is required for it.
3. Bytes never pass through the API on any upload or download path.
4. Killing the API mid-upload leaves no file stuck in a non-terminal state after one sweep cycle.
5. Two concurrent uploads to one document never produce a 500 and never orphan a `file_assets`
   row.
6. A 20 MB PDF uploads without the request timing out, with visible progress throughout.
7. Losing connectivity mid-upload and restoring it resumes rather than restarts.
8. A rejected submission's files are gone after 1 week; an approved submission's files remain.
9. MANAGER/OPS see only in-scope submissions in the review queue.
10. The API refuses to boot in production with `STORAGE_*` unset.
11. **Frontend wiring verified against the real app**, not by compilation — every cadastro screen,
    the conformity chip, the "Status" filter and the review queue, per profile. A clinic may read
    Operante in Ortopedia and Pré-cadastro in Estética; the UI must express that.

## 9. Defects closed

D-02, D-03, D-07, D-08, D-11, D-12, D-13, D-14, D-15, D-16, D-17, D-49, D-52, D-56, D-57, D-58,
D-59. See `.ai/backlog/2026-08-09-defect-register.md`.

## 10. Out of scope

Virus scanning · CDN · OCR · deduplication · push callbacks from the object store · draft locking
and takeover.
