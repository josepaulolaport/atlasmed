import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { facilityUseCases } from "../../composition";

const documentFileRole = t.Union([
  t.Literal("FRONT"),
  t.Literal("BACK"),
  t.Literal("PAGE"),
  t.Literal("ATTACHMENT"),
  t.Literal("SUPPORTING_DOCUMENT"),
]);

const createCadastroDocumentRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/cadastro/documents",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.createCadastroDocument().execute({
        facilityId: params.id,
        requirementId: body.requirementId,
        scope,
        verticalId: body.verticalId ?? undefined,
      });
    },
    {
      detail: {
        summary: "Open (or return) the working document for one requirement",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      body: t.Object({
        requirementId: t.Number({ minimum: 1 }),
        verticalId: t.Optional(t.Number({ minimum: 1 })),
      }),
    }
  );

const initiateFileUploadRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/cadastro/documents/:documentId/files/initiate",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.initiateCadastroFileUpload().execute({
        facilityId: params.id,
        documentId: params.documentId,
        scope,
        filename: body.filename,
        contentType: body.contentType,
        sizeBytes: body.sizeBytes,
        checksum: body.checksum,
        role: body.role,
        position: body.position,
      });
    },
    {
      detail: {
        summary: "Register a file and return signed upload instructions",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        documentId: t.Number({ minimum: 1 }),
      }),
      body: t.Object({
        filename: t.String({ minLength: 1, maxLength: 512 }),
        contentType: t.String({ minLength: 3, maxLength: 128 }),
        sizeBytes: t.Number({ minimum: 1 }),
        checksum: t.Optional(t.String({ minLength: 16, maxLength: 128 })),
        role: t.Optional(documentFileRole),
        position: t.Optional(t.Number({ minimum: 1 })),
      }),
    }
  );

const signUploadPartsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/cadastro/uploads/:uploadSessionId/parts/sign",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.signCadastroUploadParts().execute({
        facilityId: params.id,
        uploadSessionId: params.uploadSessionId,
        partNumbers: body.partNumbers,
        scope,
      });
    },
    {
      detail: {
        summary: "Get signed URLs for multipart upload parts",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        uploadSessionId: t.Number({ minimum: 1 }),
      }),
      body: t.Object({
        partNumbers: t.Array(t.Number({ minimum: 1 }), { minItems: 1 }),
      }),
    }
  );

const completeFileUploadRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/cadastro/uploads/complete",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.completeCadastroFileUpload().execute({
        facilityId: params.id,
        fileId: body.fileId,
        uploadSessionId: body.uploadSessionId ?? null,
        parts: body.parts,
        checksum: body.checksum,
        scope,
      });
    },
    {
      detail: {
        summary: "Complete a direct-to-storage upload and start processing",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      body: t.Object({
        fileId: t.Number({ minimum: 1 }),
        uploadSessionId: t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
        checksum: t.Optional(t.String({ minLength: 16, maxLength: 128 })),
        parts: t.Optional(
          t.Array(
            t.Object({
              partNumber: t.Number({ minimum: 1 }),
              etag: t.String({ minLength: 1 }),
              sizeBytes: t.Optional(t.Number({ minimum: 1 })),
            })
          )
        ),
      }),
    }
  );

const reorderDocumentFilesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .patch(
    "/facilities/:id/cadastro/documents/:documentId/files/reorder",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.reorderCadastroDocumentFiles().execute({
        facilityId: params.id,
        documentId: params.documentId,
        scope,
        ordered: body.ordered,
      });
    },
    {
      detail: {
        summary: "Reorder pages/files of a logical cadastro document",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        documentId: t.Number({ minimum: 1 }),
      }),
      body: t.Object({
        ordered: t.Array(
          t.Object({
            fileAssetId: t.Number({ minimum: 1 }),
            position: t.Number({ minimum: 1 }),
            role: documentFileRole,
          }),
          { minItems: 1 }
        ),
      }),
    }
  );

const getFileSignedUrlRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/cadastro/files/:fileAssetId/url",
    async ({ params, query, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.getCadastroFileSignedUrl().execute({
        facilityId: params.id,
        fileAssetId: params.fileAssetId,
        scope,
        variant: query.variant,
      });
    },
    {
      detail: {
        summary: "Get a short-lived signed URL for a cadastro file",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        fileAssetId: t.Number({ minimum: 1 }),
      }),
      query: t.Object({
        variant: t.Optional(
          t.Union([
            t.Literal("original"),
            t.Literal("thumb"),
            t.Literal("preview"),
          ])
        ),
      }),
    }
  );

const deleteCadastroDocumentRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .delete(
    "/facilities/:id/cadastro/documents/:documentId",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.deleteCadastroDocument().execute({
        facilityId: params.id,
        documentId: params.documentId,
        scope,
      });
    },
    {
      detail: {
        summary: "Discard one unsent cadastro document and its files",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        documentId: t.Number({ minimum: 1 }),
      }),
    }
  );

const reviewDocumentRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CADASTRO_SUBMISSION"))
  .post(
    "/facilities/:id/cadastro/documents/:documentId/review",
    async ({ params, body, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return facilityUseCases.reviewCadastroDocument().execute({
        facilityId: params.id,
        documentId: params.documentId,
        userId,
        scope,
        decision: body.decision,
        comment: body.comment,
        reasonCode: body.reasonCode,
        flaggedFileAssetIds: body.flaggedFileAssetIds,
        validUntil: body.validUntil,
      });
    },
    {
      detail: {
        summary: "Approve, reject, or request changes on a logical document",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        documentId: t.Number({ minimum: 1 }),
      }),
      body: t.Object({
        decision: t.Union([
          t.Literal("APPROVED"),
          t.Literal("REJECTED"),
          t.Literal("CHANGES_REQUESTED"),
        ]),
        comment: t.Optional(t.String({ maxLength: 2000 })),
        reasonCode: t.Optional(t.String({ maxLength: 64 })),
        flaggedFileAssetIds: t.Optional(t.Array(t.Number({ minimum: 1 }))),
        /** Reviewer's confirm-or-correct, on approval only (ADR 0008 §6). */
        validUntil: t.Optional(
          t.String({ minLength: 10, maxLength: 10, pattern: "^\\d{4}-\\d{2}-\\d{2}$" })
        ),
      }),
    }
  );

const listRequirementSubmissionsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/cadastro/requirements/:requirementId/submissions",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.listCadastroRequirementSubmissions().execute({
        facilityId: params.id,
        requirementId: params.requirementId,
        scope,
      });
    },
    {
      detail: {
        summary: "List submitted history for one Cadastro document type",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        requirementId: t.Number({ minimum: 1 }),
      }),
    }
  );

const submitRequirementRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/cadastro/requirements/:requirementId/submit",
    async ({ params, body, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return facilityUseCases.submitCadastroRequirement().execute({
        facilityId: params.id,
        requirementId: params.requirementId,
        userId,
        scope,
        documentId: body?.documentId,
        validUntil: body?.validUntil,
      });
    },
    {
      detail: {
        summary: "Submit one Cadastro document type for review immediately",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        requirementId: t.Number({ minimum: 1 }),
      }),
      body: t.Optional(
        t.Object({
          documentId: t.Optional(t.Number({ minimum: 1 })),
          /** Required where the requirement declares one (spec 0011 §3.3). */
          validUntil: t.Optional(
            t.String({ minLength: 10, maxLength: 10, pattern: "^\\d{4}-\\d{2}-\\d{2}$" })
          ),
        })
      ),
    }
  );

export const cadastroDocumentsRoute = new Elysia()
  .use(createCadastroDocumentRoute)
  .use(initiateFileUploadRoute)
  .use(signUploadPartsRoute)
  .use(completeFileUploadRoute)
  .use(reorderDocumentFilesRoute)
  .use(getFileSignedUrlRoute)
  .use(submitRequirementRoute)
  .use(listRequirementSubmissionsRoute)
  .use(deleteCadastroDocumentRoute)
  .use(reviewDocumentRoute);
