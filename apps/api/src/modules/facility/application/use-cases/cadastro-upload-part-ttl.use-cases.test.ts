import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";

const signedUploadPartUrl = mock(
  async (_key: string, _uploadId: string, partNumber: number, _ttl?: number) =>
    `https://storage.example/part/${partNumber}`
);

mock.module("../../../../infrastructure/storage/storage.service", () => ({
  storageService: {
    signedUploadPartUrl,
    isConfigured: () => true,
    bucket: () => "test-bucket",
  },
}));

const { SignCadastroUploadPartsUseCase } = await import(
  "./cadastro-submission.use-cases"
);
const { ValidationError } = await import("../../../../shared/errors");

/**
 * Part URLs were signed with the default 1-hour TTL against a 6-hour upload
 * session, so a slow or resumed multipart upload got `403 SignatureDoesNotMatch`
 * *after* the bytes were already moving (spec 0011 §2.1). The failure surfaced
 * as a storage error, which is why it read as flakiness rather than expiry.
 */
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

function useCaseWith(expiresAt: Date) {
  return new SignCadastroUploadPartsUseCase({
    cadastroRepository: {
      findUploadSessionById: async () => ({
        id: 1,
        fileAssetId: 5,
        storageUploadId: "upload-1",
        status: "PENDING",
        partSize: 10,
        expiresAt,
        createdAt: new Date(),
        completedAt: null,
      }),
      findFileAssetById: async () => ({ id: 5, facilityId: 1, objectKey: "k" }),
      updateUploadSession: async () => ({}),
    },
  } as never);
}

describe("signing multipart upload parts", () => {
  it("signs parts for the session's remaining lifetime, not a fixed hour", async () => {
    signedUploadPartUrl.mockClear();
    // Five hours left of a six-hour session.
    const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000);

    await useCaseWith(expiresAt).execute({
      facilityId: 1,
      uploadSessionId: 1,
      partNumbers: [1, 2],
      scope: globalScope,
    });

    expect(signedUploadPartUrl).toHaveBeenCalledTimes(2);
    const ttl = signedUploadPartUrl.mock.calls[0]![3] as number;
    // Allow a second of drift for the clock read inside the use case.
    expect(ttl).toBeGreaterThan(5 * 60 * 60 - 5);
    expect(ttl).toBeLessThanOrEqual(5 * 60 * 60);
  });

  it("refuses to sign against an already-expired session", async () => {
    signedUploadPartUrl.mockClear();

    await expect(
      useCaseWith(new Date(Date.now() - 60_000)).execute({
        facilityId: 1,
        uploadSessionId: 1,
        partNumbers: [1],
        scope: globalScope,
      })
    ).rejects.toBeInstanceOf(ValidationError);

    // Signing a URL that is dead on arrival is worse than refusing: the client
    // uploads bytes and only then learns the signature is invalid.
    expect(signedUploadPartUrl).not.toHaveBeenCalled();
  });
});
