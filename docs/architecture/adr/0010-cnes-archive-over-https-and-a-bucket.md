# ADR 0010 — Fetch the CNES archive over HTTPS, and keep it in a bucket

**Status:** Accepted · **Date:** 2026-08-13
**Supersedes in part:** ADR 0009 § 4 ("The archive is never downloaded whole"), and with it
ADR 0006's exclusion of archive storage.
**Relates:** Spec 0012

## Context

ADR 0009 read the six entries it needs straight out of the remote ZIP by byte range, so nothing
was stored. That worked — a full load ran in 80 s, twice, with identical counts — and then
stopped working, in a way worth recording because it took most of a day to characterise and four
of my explanations were wrong.

**Measured, on the same file, within minutes of each other:**

| | |
|---|---|
| `curl`, 65536 bytes from offset 725097909 | **65536** ✅ |
| `basic-ftp`, the identical range | **59744**, on 14 of 14 attempts |

The archive is not at fault: `SIZE` is stable at 725 163 445, `unzip -t` reports no errors, and
the last bytes are a valid end-of-central-directory record declaring 109 entries. Nor is the
origin rate-limiting us — that was asserted here repeatedly and was wrong. Forcing `TYPE I` did
not change it either. **The truncation is in our FTP client and its mechanism is unexplained.**

Two facts then reframed the problem:

- **`cnes.datasus.gov.br` serves the same archive over HTTPS**, complete, in **141 s at
  5.1 MB/s** — verified byte-for-byte against the FTP-reported size and by `unzip -t`.
- That endpoint sends `Transfer-Encoding: chunked` and **honours no byte ranges at all**.

So neither source supports both halves of the job. FTP has ranges we cannot read; HTTPS is
reliable but sequential only.

## Decision

**Fetch whole over HTTPS, store in the object bucket, and read entries from there.**

```
discover      GET /services/arquivos-download/base-dados/   (JSON, newest first)
ensureArchive HTTPS stream ──▶ S3 multipart, then verified
loadRegistry  S3 ranges ──▶ inflate ──▶ parse ──▶ validation ──▶ registry.*
```

Each half now uses the transport it is good at: one sequential stream for the fetch, real range
requests for the reads.

**The ZIP is stored as-is, not unzipped.** Unzipping does not remove the ZIP parsing — you need
the central directory to find entry boundaries in the first place, and all 109 entries set the
data-descriptor bit, so a sequential reader cannot find them without inflating everything. It
would cost 2.01 GB instead of 725 MB to avoid nothing.

**One workflow, two activities — not two workers.** What is wanted is that a failed load must not
re-fetch, and an activity boundary over a durable object already gives that: Temporal retries
`loadRegistry` alone, starting from the bucket. Two workflows would buy the same thing while
adding a second schedule, a second ledger row, and the question of who correlates them.
`ingestion.cnes_runs` was shaped for this: one row per competence, with `DOWNLOADING` and
`LOADING` already in its phase enum.

**`ensureArchive` is idempotent.** Object present and structurally valid ⇒ return immediately.
That makes "re-run the load without re-downloading" the default rather than a special path, and
it collapses the manual-upload fallback into the same code path: put a ZIP at the key by hand and
the activity simply skips.

**Integrity is checked structurally, not by size.** Chunked encoding means there is no
`Content-Length` to compare against, and this pipeline has already been observed receiving short
data *without raising an error*. So after upload: read the tail back, parse the
end-of-central-directory record, and require that it declares 109 entries and that its offsets
land exactly on the stored object's size. Anything else deletes the object and fails the
activity. A truncated archive must fail here, loudly, rather than three entries into a load.

**Existence is never inferred from an HTTP status.** `BASE_DE_DADOS_CNES_202608.ZIP` — a
competence that does not exist — answers `200` with an empty body. Discovery uses the listing
endpoint, and the fetch additionally requires the ZIP magic `50 4b 03 04`.

## Consequences

**Positive**
- The failing component leaves the tree: `basic-ftp` and the ranged FTP reader are deleted.
- A failed load costs nothing to retry; the 141 s fetch happens once per competence.
- `archive_manifest` regains its original meaning — there is an archive, and it has a key.
- The archive is inspectable when something goes wrong, which it was not before.

**Negative / accepted**
- **725 MB per competence.** A lifecycle rule is mandatory, not optional.
- Discovery depends on a JSON endpoint that **requires a browser `User-Agent`**; without one it
  answers "Your connection was refused". That is fragile, and a future 403 should be read as this
  changing rather than as an outage.
- One more phase that can fail — though the ledger already modelled it.

**Neutral**
- The loader, the CSV parser, `zip-directory.ts`, `skipLocalHeader` and the validation are
  untouched. Only the byte source changes, which is what the `CnesSource` seam was for.

## Alternatives considered

**Keep ranged FTP and retry harder.** Rejected: 14 of 14 attempts returned the same truncated
length, and eight retries with backoff inside one run still failed. Retrying an operation that
fails deterministically is not resilience.

**Store the entries unzipped.** Rejected on cost and on the fact that it does not remove the
work — see above.

**Two workflows, fetch and load.** Rejected: activity boundaries already provide the checkpoint,
without splitting the run ledger.

**Fix the FTP client.** Not attempted. The mechanism is unknown after four wrong hypotheses, and
HTTPS makes the question moot rather than merely deferred.

## References

- ADR 0009 — the ranged-FTP design this replaces
- ADR 0006 — the archive-storage exclusion this reverses
- Spec 0012 §§ 2, 5
