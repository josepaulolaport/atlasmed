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

const ensureDraftSubmissionRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/cadastro/submissions",
    async ({ params, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return facilityUseCases.ensureDraftCadastroSubmission().execute({
        facilityId: params.id,
        userId,
        scope,
      });
    },
    {
      detail: {
        summary: "Create or return the current DRAFT cadastro submission",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const createSubmissionDocumentRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/cadastro/submissions/:submissionId/documents",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.createCadastroSubmissionDocument().execute({
        facilityId: params.id,
        submissionId: params.submissionId,
        requirementId: body.requirementId,
        scope,
      });
    },
    {
      detail: {
        summary: "Create a logical document inside a cadastro submission",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        requirementId: t.String({ minLength: 1 }),
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
        uploadSessionId: body.uploadSessionId,
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
      body: t.Object({
        fileId: t.String({ minLength: 1 }),
        uploadSessionId: t.Optional(t.Nullable(t.String())),
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
      body: t.Object({
        ordered: t.Array(
          t.Object({
            fileAssetId: t.String(),
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

const submitPackageRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/cadastro/submissions/:submissionId/submit",
    async ({ params, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return facilityUseCases.submitCadastroSubmission().execute({
        facilityId: params.id,
        submissionId: params.submissionId,
        userId,
        scope,
      });
    },
    {
      detail: {
        summary: "Freeze and submit a cadastro package for review",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const deleteDraftSubmissionRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .delete(
    "/facilities/:id/cadastro/submissions/:submissionId",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.deleteDraftCadastroSubmission().execute({
        facilityId: params.id,
        submissionId: params.submissionId,
        scope,
      });
    },
    {
      detail: {
        summary: "Delete a DRAFT cadastro submission package",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const reviewDocumentRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
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
      });
    },
    {
      detail: {
        summary: "Approve, reject, or request changes on a logical document",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        decision: t.Union([
          t.Literal("APPROVED"),
          t.Literal("REJECTED"),
          t.Literal("CHANGES_REQUESTED"),
        ]),
        comment: t.Optional(t.String({ maxLength: 2000 })),
        reasonCode: t.Optional(t.String({ maxLength: 64 })),
        flaggedFileAssetIds: t.Optional(t.Array(t.String())),
      }),
    }
  );

const listPackageSubmissionsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY"))
  .get(
    "/cadastro/packages",
    async ({ query }) => {
      return facilityUseCases.listCadastroPackageSubmissions().execute({
        status: query.status
          ? [query.status as "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"]
          : undefined,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      });
    },
    {
      detail: {
        summary: "List versioned cadastro submission packages for ops review",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        status: t.Optional(
          t.Union([
            t.Literal("UNDER_REVIEW"),
            t.Literal("APPROVED"),
            t.Literal("REJECTED"),
            t.Literal("CHANGES_REQUESTED"),
          ])
        ),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
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
      });
    },
    {
      detail: {
        summary: "Submit one Cadastro document type for review immediately",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Optional(
        t.Object({
          documentId: t.Optional(t.String({ minLength: 1 })),
        })
      ),
    }
  );

export const cadastroSubmissionsRoute = new Elysia()
  .use(ensureDraftSubmissionRoute)
  .use(createSubmissionDocumentRoute)
  .use(initiateFileUploadRoute)
  .use(signUploadPartsRoute)
  .use(completeFileUploadRoute)
  .use(reorderDocumentFilesRoute)
  .use(getFileSignedUrlRoute)
  .use(submitPackageRoute)
  .use(submitRequirementRoute)
  .use(listRequirementSubmissionsRoute)
  .use(deleteDraftSubmissionRoute)
  .use(reviewDocumentRoute)
  .use(listPackageSubmissionsRoute);
