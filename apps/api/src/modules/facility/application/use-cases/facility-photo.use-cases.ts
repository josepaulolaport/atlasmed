import { randomUUID } from "node:crypto";
import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { FacilityPhotoRepository } from "../interfaces/facility-photo.repository.interface";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type { AvatarStoragePort } from "../../../access/application/use-cases/update-avatar.use-case";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

interface Dependencies {
  facilityPhotoRepository: FacilityPhotoRepository;
  facilityRepository: FacilityRepository;
  storage: AvatarStoragePort;
}

function serializePhoto(photo: {
  id: string;
  url: string;
  contentType: string;
  createdAt: Date;
}) {
  return {
    id: photo.id,
    url: photo.url,
    contentType: photo.contentType,
    createdAt: photo.createdAt.toISOString(),
  };
}

function photoUrl(key: string): string {
  return `/api/v1/facilities/photos/${key}`;
}

export class ListFacilityPhotosUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { facilityId: string; scope: ScopeContext }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const facility = await this.deps.facilityRepository.findById(input.facilityId);
    if (!facility) {
      throw new ResourceNotFoundError("Facility", input.facilityId);
    }

    const photos = await this.deps.facilityPhotoRepository.findByFacility(
      input.facilityId
    );

    return {
      imageUrl: facility.imageUrl ?? null,
      data: photos.map(serializePhoto),
    };
  }
}

export class UploadFacilityPhotoUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    userId: string;
    scope: ScopeContext;
    file: File;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const facility = await this.deps.facilityRepository.findById(input.facilityId);
    if (!facility) {
      throw new ResourceNotFoundError("Facility", input.facilityId);
    }

    const extension = imageExtensions[input.file.type];
    if (!extension) {
      throw new ValidationError([
        { field: "photo", message: "Photo must be a JPEG, PNG, or WebP image" },
      ]);
    }

    if (input.file.size === 0 || input.file.size > MAX_PHOTO_BYTES) {
      throw new ValidationError([
        { field: "photo", message: "Photo must be between 1 byte and 5 MB" },
      ]);
    }

    const key = `facilities/${input.facilityId}/${randomUUID()}.${extension}`;
    await this.deps.storage.upload(
      key,
      new Uint8Array(await input.file.arrayBuffer()),
      input.file.type
    );

    const url = photoUrl(key);
    const created = await this.deps.facilityPhotoRepository.create({
      facilityId: input.facilityId,
      storageKey: key,
      url,
      contentType: input.file.type,
      uploadedByUserId: input.userId,
    });

    if (!facility.imageUrl) {
      await this.deps.facilityRepository.update(input.facilityId, {
        imageUrl: url,
      });
    }

    return serializePhoto(created);
  }
}

export class DownloadFacilityPhotoUseCase {
  constructor(
    private readonly deps: {
      facilityPhotoRepository: FacilityPhotoRepository;
      storage: AvatarStoragePort & { download(key: string): Promise<Uint8Array> };
    }
  ) {}

  async execute(input: { storageKey: string }) {
    if (
      !/^facilities\/[a-zA-Z0-9_-]+\/[a-z0-9-]+\.(jpg|png|webp)$/.test(
        input.storageKey
      )
    ) {
      throw new ValidationError([
        { field: "key", message: "Invalid facility photo key" },
      ]);
    }

    const photo = await this.deps.facilityPhotoRepository.findByStorageKey(
      input.storageKey
    );
    if (!photo) {
      throw new ResourceNotFoundError("FacilityPhoto", input.storageKey);
    }

    const bytes = await this.deps.storage.download(input.storageKey);
    return { bytes, contentType: photo.contentType };
  }
}
