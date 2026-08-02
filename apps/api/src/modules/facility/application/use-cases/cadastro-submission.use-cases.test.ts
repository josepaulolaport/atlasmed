import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import type {
  CadastroSubmissionRepository,
  FileAssetRecord,
} from "../interfaces/cadastro-submission.repository.interface";
import type { ConformityRepository } from "../interfaces/conformity.repository.interface";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import type { FacilityCadastroCompletionService } from "../services/facility-cadastro-completion.service";
import { CompleteCadastroFileUploadUseCase } from "./cadastro-submission.use-cases";

const globalScope: ScopeContext = {
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
};

const asset: FileAssetRecord = {
  id: "file-1",
  facilityId: "facility-1",
  storageProvider: "s3",
  bucket: "atlasmed-production",
  objectKey: "facilities/facility-1/file-1/original",
  thumbObjectKey: null,
  previewObjectKey: null,
  originalFilename: "documento.pdf",
  declaredMimeType: "application/pdf",
  detectedMimeType: null,
  sizeBytes: 128,
  sha256: null,
  status: "UPLOADING",
  pageCount: null,
  width: null,
  height: null,
  errorCode: null,
  errorMessage: null,
  uploadedAt: null,
  processedAt: null,
  createdAt: new Date("2026-08-02T12:00:00.000Z"),
  updatedAt: new Date("2026-08-02T12:00:00.000Z"),
};

describe("CompleteCadastroFileUploadUseCase", () => {
  it("returns PROCESSING after scheduling Temporal without downloading the file inline", async () => {
    const updateFileAsset = mock(async (input: { status?: string }) => ({
      ...asset,
      status: input.status ?? asset.status,
    }));
    const startWorkflow = mock(async () => ({ workflowId: "cadastro-file-file-1" }));

    const useCase = new CompleteCadastroFileUploadUseCase({
      facilityRepository: {} as FacilityRepository,
      conformityRepository: {} as ConformityRepository,
      cadastroRepository: {
        findFileAssetById: async () => asset,
        updateFileAsset,
      } as unknown as CadastroSubmissionRepository,
      completionService: {} as FacilityCadastroCompletionService,
      storage: {
        headObject: async () => ({ exists: true, contentLength: asset.sizeBytes }),
        completeMultipartUpload: async () => undefined,
      },
      startCadastroFileUploadedWorkflow: startWorkflow,
    });

    const result = await useCase.execute({
      facilityId: "facility-1",
      fileId: asset.id,
      scope: globalScope,
      checksum: "checksum",
    });

    expect(result).toEqual({
      fileId: asset.id,
      status: "PROCESSING",
      workflowId: "cadastro-file-file-1",
    });
    expect(startWorkflow).toHaveBeenCalledWith({
      fileAssetId: asset.id,
      bucket: asset.bucket,
      objectKey: asset.objectKey,
    });
    expect(updateFileAsset).toHaveBeenCalledTimes(1);
  });

  it("restores UPLOADED when Temporal cannot schedule processing", async () => {
    const statuses: string[] = [];
    const useCase = new CompleteCadastroFileUploadUseCase({
      facilityRepository: {} as FacilityRepository,
      conformityRepository: {} as ConformityRepository,
      cadastroRepository: {
        findFileAssetById: async () => asset,
        updateFileAsset: async (input: { status?: string }) => {
          if (input.status) statuses.push(input.status);
          return { ...asset, status: input.status ?? asset.status };
        },
      } as unknown as CadastroSubmissionRepository,
      completionService: {} as FacilityCadastroCompletionService,
      storage: {
        headObject: async () => ({ exists: true, contentLength: asset.sizeBytes }),
        completeMultipartUpload: async () => undefined,
      },
      startCadastroFileUploadedWorkflow: async () => {
        throw new Error("Temporal unavailable");
      },
    });

    await expect(
      useCase.execute({
        facilityId: "facility-1",
        fileId: asset.id,
        scope: globalScope,
      }),
    ).rejects.toThrow("Temporal unavailable");

    expect(statuses).toEqual(["PROCESSING", "UPLOADED"]);
  });
});
