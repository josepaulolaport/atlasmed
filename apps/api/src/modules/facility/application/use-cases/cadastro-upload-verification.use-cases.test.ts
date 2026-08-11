import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";

/**
 * `/uploads/complete` used to believe the client: it marked the asset UPLOADED,
 * downloaded every byte back to hash and sniff them, re-uploaded two identical
 * copies as `/thumb` and `/preview`, and started a Temporal workflow that raced
 * the same row. ADR 0008 replaces all of it with one `HEAD` — the store answers,
 * and its answer decides READY or FAILED.
 *
 * These tests pin the three properties that matter: no byte transfer, the size
 * the store reports wins over the size the client promised, and the multipart
 * branch is verified too (it previously skipped the check entirely).
 */

const headObject = mock(
  async (_key: string) =>
    ({ exists: true, contentLength: 1024, contentType: "image/jpeg" }) as {
      exists: boolean;
      contentLength?: number;
      contentType?: string;
    }
);
const download = mock(async (_key: string) => new Uint8Array([1, 2, 3]));
const upload = mock(async () => undefined);
const completeMultipartUpload = mock(async () => undefined);

mock.module("../../../../infrastructure/storage/storage.service", () => ({
  storageService: {
    headObject,
    download,
    upload,
    completeMultipartUpload,
    isConfigured: () => true,
    bucket: () => "test-bucket",
  },
}));

const { CompleteCadastroFileUploadUseCase } = await import(
  "./cadastro-submission.use-cases"
);

const globalScope = {
  isGlobal: true,
  assignedTerritoryIds: [],
  effectiveTerritoryIds: [],
  analyticsEffectiveTerritoryIds: [],
  territoryIds: [],
  facilityIds: [],
  analyticsFacilityIds: [],
  clinicIds: [],
  analyticsClinicIds: [],
  managedUserIds: [],
  isOperationallyActive: true,
} as ScopeContext;

const DECLARED_SIZE = 1024;

function useCaseWith(options: { session?: boolean } = {}) {
  const updates: Array<Record<string, unknown>> = [];
  const asset = {
    id: 5,
    facilityId: 1,
    bucket: "test-bucket",
    objectKey: "facilities/1/documents/2/v1/files/abc/original",
    declaredMimeType: "image/jpeg",
    sizeBytes: DECLARED_SIZE,
    sha256: null,
    status: "UPLOADING",
  };

  const useCase = new CompleteCadastroFileUploadUseCase({
    cadastroRepository: {
      findFileAssetById: async () => asset,
      findUploadSessionById: async () =>
        options.session
          ? { id: 9, fileAssetId: 5, storageUploadId: "upload-1" }
          : null,
      upsertUploadPart: async () => ({}),
      updateUploadSession: async () => ({}),
      updateFileAsset: async (input: Record<string, unknown>) => {
        updates.push(input);
        return { ...asset, ...input };
      },
      // The document-readiness rollup is exercised elsewhere; here it must not
      // be what decides the file's own status.
      listDocumentFilesByFileAssetId: async () => [],
      findDocumentFileByFileAssetId: async () => null,
    },
  } as never);

  return { useCase, updates };
}

describe("completing an upload asks the store, not the client", () => {
  it("marks READY on a HEAD that matches, without transferring bytes", async () => {
    headObject.mockClear();
    download.mockClear();
    upload.mockClear();
    headObject.mockImplementation(async () => ({
      exists: true,
      contentLength: DECLARED_SIZE,
      contentType: "image/jpeg",
    }));

    const { useCase, updates } = useCaseWith();
    const result = await useCase.execute({
      facilityId: 1,
      fileId: 5,
      scope: globalScope,
    });

    expect(result.status).toBe("READY");
    expect(headObject).toHaveBeenCalledTimes(1);

    // The point of the change: verification costs one metadata call. A download
    // here would put the rep's latency back on the size of their own file, and
    // an upload would be the thumb/preview copies nothing ever read.
    expect(download).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();

    expect(updates.at(-1)).toMatchObject({ status: "READY" });
  });

  it("marks FAILED when the store has no such object", async () => {
    headObject.mockClear();
    headObject.mockImplementation(async () => ({ exists: false }));

    const { useCase, updates } = useCaseWith();
    const result = await useCase.execute({
      facilityId: 1,
      fileId: 5,
      scope: globalScope,
    });

    // A client that PUT nothing and called complete anyway is the orphan case
    // from spec 0011 §1. It must not leave a file looking uploaded.
    expect(result.status).toBe("FAILED");
    expect(updates.at(-1)).toMatchObject({
      status: "FAILED",
      errorCode: "VERIFICATION_FAILED",
    });
  });

  it("marks FAILED when the stored size contradicts the declared size", async () => {
    headObject.mockClear();
    headObject.mockImplementation(async () => ({
      exists: true,
      contentLength: 12,
      contentType: "image/jpeg",
    }));

    const { useCase, updates } = useCaseWith();
    const result = await useCase.execute({
      facilityId: 1,
      fileId: 5,
      scope: globalScope,
    });

    // The size limits at initiate were checked against the client's declared
    // number. This is where that promise is held to the store's measurement —
    // a truncated PUT and a size-limit bypass look the same here, and both fail.
    expect(result.status).toBe("FAILED");
    expect(updates.at(-1)).toMatchObject({ status: "FAILED" });
    expect(String(updates.at(-1)!.errorMessage)).toContain("1024");
  });

  it("verifies the multipart branch too", async () => {
    headObject.mockClear();
    completeMultipartUpload.mockClear();
    headObject.mockImplementation(async () => ({
      exists: true,
      contentLength: 7,
      contentType: "image/jpeg",
    }));

    const { useCase, updates } = useCaseWith({ session: true });
    const result = await useCase.execute({
      facilityId: 1,
      fileId: 5,
      uploadSessionId: 9,
      parts: [{ partNumber: 1, etag: "e1" }],
      scope: globalScope,
    });

    // CompleteMultipartUpload succeeding says the parts were assembled, not that
    // the assembled object is the one that was promised. This branch used to
    // return READY on that assumption alone.
    expect(completeMultipartUpload).toHaveBeenCalledTimes(1);
    expect(headObject).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("FAILED");
    expect(updates.at(-1)).toMatchObject({ status: "FAILED" });
  });
});
