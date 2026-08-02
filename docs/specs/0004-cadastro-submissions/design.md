# Cadastro submissions — multi-file storage

## Goal

Separate **logical documents** (e.g. Medical License) from **physical file assets**, upload bytes directly to private object storage, process asynchronously with Temporal, and keep **manual review** on the logical document.

## Model

```text
Facility
 └── cadastro_submissions (versioned package)
      └── submission_documents (↔ conformity_requirements)
           └── document_files (ordered, role)
                └── file_assets (S3 object)
```

Statuses:

- Submission: `DRAFT` → `UNDER_REVIEW` → `APPROVED` | `REJECTED` | `SUPERSEDED` (corrections open a new version)
- Document: `DRAFT` | `PROCESSING` | `READY` | `UNDER_REVIEW` | `APPROVED` | `REJECTED` | `CHANGES_REQUESTED`
- File: `PENDING_UPLOAD` → `UPLOADING` → `UPLOADED` → `PROCESSING` → `READY` | `FAILED`

## Upload flow

1. `POST /facilities/:id/cadastro/submissions` — ensure DRAFT
2. `POST …/submissions/:submissionId/documents` — logical document
3. `POST …/documents/:documentId/files/initiate` — create `file_assets` + signed PUT or multipart session
4. Client uploads to object storage
5. `POST …/uploads/complete` — confirm storage, mark `PROCESSING`, start `cadastroFileUploadedWorkflow`, and return without downloading the file
6. Worker uses the internal object-storage endpoint, validates checksum/MIME, and marks `READY`
7. `POST …/submissions/:submissionId/submit` — freeze package for ops review
8. `POST …/documents/:documentId/review` — approve / reject / request changes

Bytes never stream through the Bun API for new uploads. Preview/download uses short-lived signed GET URLs.

## Out of scope (v1)

- Virus scanning / quarantine
- OCR / duplicate detection
- Auto-combined review PDF
