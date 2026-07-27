import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import type { FacilityPhotoRepository } from "../interfaces/facility-photo.repository.interface";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import {
  DownloadFacilityPhotoUseCase,
  ListFacilityPhotosUseCase,
  UploadFacilityPhotoUseCase,
} from "./facility-photo.use-cases";

const now = new Date("2026-01-15T12:00:00.000Z");

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

function facility(overrides: Partial<{ id: string; imageUrl: string | null }> = {}) {
  return {
    id: overrides.id ?? "facility-1",
    imageUrl: overrides.imageUrl ?? null,
  } as Awaited<ReturnType<FacilityRepository["findById"]>>;
}

describe("Facility photo use cases", () => {
  it("lists photos and profile imageUrl", async () => {
    const findByFacility = mock(async () => [
      {
        id: "photo-1",
        facilityId: "facility-1",
        storageKey: "facilities/facility-1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg",
        url: "/api/v1/facilities/photos/facilities/facility-1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg",
        contentType: "image/jpeg",
        blurhash: null,
        uploadedByUserId: "user-1",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await new ListFacilityPhotosUseCase({
      facilityPhotoRepository: {
        findByFacility,
        create: async () => {
          throw new Error("unused");
        },
        findById: async () => null,
        findByStorageKey: async () => null,
      } satisfies FacilityPhotoRepository,
      facilityRepository: {
        findById: async () =>
          facility({ imageUrl: "/api/v1/facilities/photos/facilities/facility-1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg" }),
      } as unknown as FacilityRepository,
      storage: {
        upload: async () => undefined,
        delete: async () => undefined,
      },
    }).execute({ facilityId: "facility-1", scope: globalScope });

    expect(findByFacility).toHaveBeenCalledWith("facility-1");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe("photo-1");
    expect(result.imageUrl).toContain("/api/v1/facilities/photos/");
  });

  it("uploads a photo and sets imageUrl when missing", async () => {
    const upload = mock(async () => undefined);
    const create = mock(async (input: {
      facilityId: string;
      storageKey: string;
      url: string;
      contentType: string;
      blurhash?: string | null;
      uploadedByUserId: string;
    }) => ({
      id: "photo-2",
      ...input,
      blurhash: input.blurhash ?? null,
      createdAt: now,
      updatedAt: now,
    }));
    const update = mock(async () => facility({ imageUrl: "set" }));

    const file = new File([new Uint8Array([1, 2, 3])], "clinic.png", {
      type: "image/png",
    });

    const result = await new UploadFacilityPhotoUseCase({
      facilityPhotoRepository: {
        findByFacility: async () => [],
        create,
        findById: async () => null,
        findByStorageKey: async () => null,
      },
      facilityRepository: {
        findById: async () => facility({ imageUrl: null }),
        update,
      } as unknown as FacilityRepository,
      storage: {
        upload,
        delete: async () => undefined,
      },
    }).execute({
      facilityId: "facility-1",
      userId: "user-1",
      scope: globalScope,
      file,
    });

    expect(upload).toHaveBeenCalled();
    expect(create).toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
    expect(result.contentType).toBe("image/png");
    expect(result.url).toMatch(/^\/api\/v1\/facilities\/photos\/facilities\/facility-1\//);
  });

  it("downloads a photo by storage key", async () => {
    const key =
      "facilities/facility-1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg";
    const download = mock(async () => new Uint8Array([9, 8, 7]));

    const result = await new DownloadFacilityPhotoUseCase({
      facilityPhotoRepository: {
        findByFacility: async () => [],
        create: async () => {
          throw new Error("unused");
        },
        findById: async () => null,
        findByStorageKey: async () => ({
          id: "photo-1",
          facilityId: "facility-1",
          storageKey: key,
          url: `/api/v1/facilities/photos/${key}`,
          contentType: "image/jpeg",
          blurhash: null,
          uploadedByUserId: "user-1",
          createdAt: now,
          updatedAt: now,
        }),
      },
      storage: {
        upload: async () => undefined,
        delete: async () => undefined,
        download,
      },
    }).execute({ storageKey: key });

    expect(download).toHaveBeenCalledWith(key);
    expect(result.contentType).toBe("image/jpeg");
    expect(result.bytes).toEqual(new Uint8Array([9, 8, 7]));
  });

  it("rejects invalid download keys", async () => {
    await expect(
      new DownloadFacilityPhotoUseCase({
        facilityPhotoRepository: {
          findByFacility: async () => [],
          create: async () => {
            throw new Error("unused");
          },
          findById: async () => null,
          findByStorageKey: async () => null,
        },
        storage: {
          upload: async () => undefined,
          delete: async () => undefined,
          download: async () => new Uint8Array(),
        },
      }).execute({ storageKey: "../etc/passwd" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("denies facilities outside scope", async () => {
    await expect(
      new ListFacilityPhotosUseCase({
        facilityPhotoRepository: {
          findByFacility: async () => {
            throw new Error("should not query");
          },
          create: async () => {
            throw new Error("unused");
          },
          findById: async () => null,
          findByStorageKey: async () => null,
        },
        facilityRepository: {
          findById: async () => {
            throw new Error("should not query");
          },
        } as unknown as FacilityRepository,
        storage: {
          upload: async () => undefined,
          delete: async () => undefined,
        },
      }).execute({
        facilityId: "facility-out",
        scope: {
          ...globalScope,
          isGlobal: false,
          facilityIds: ["facility-1"],
          clinicIds: ["facility-1"],
        },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
