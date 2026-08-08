import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "../../../../shared/errors";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

function serializeType(type: {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  canHaveBoundary: boolean;
  blockSiblingOverlap: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: type.id,
    slug: type.slug,
    name: type.name,
    description: type.description ?? undefined,
    canHaveBoundary: type.canHaveBoundary,
    blockSiblingOverlap: type.blockSiblingOverlap,
    isActive: type.isActive,
    createdAt: type.createdAt.toISOString(),
    updatedAt: type.updatedAt.toISOString(),
  };
}

export class TerritoryTypeUseCases {
  constructor(private readonly typeRepository: TerritoryTypeRepository) {}

  async listTypes() {
    const types = await this.typeRepository.findAll(true);
    return { data: types.map(serializeType) };
  }

  async getType(id: number) {
    const type = await this.typeRepository.findById(id);
    if (!type) {
      throw new ResourceNotFoundError("TerritoryType", id);
    }
    return serializeType(type);
  }

  async createType(input: {
    slug: string;
    name: string;
    description?: string;
    canHaveBoundary?: boolean;
    blockSiblingOverlap?: boolean;
  }) {
    const slug = input.slug.trim().toLowerCase();
    if (!SLUG_PATTERN.test(slug)) {
      throw new OperationNotAllowedError(
        "create_territory_type",
        "slug must be 3-50 lowercase alphanumeric characters with optional hyphens"
      );
    }

    const existing = await this.typeRepository.findBySlug(slug);
    if (existing) {
      throw new OperationNotAllowedError(
        "create_territory_type",
        `Territory type slug '${slug}' already exists`
      );
    }

    const type = await this.typeRepository.create({
      slug,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      canHaveBoundary: input.canHaveBoundary,
      blockSiblingOverlap: input.blockSiblingOverlap,
    });

    return serializeType(type);
  }

  async updateType(
    id: number,
    input: {
      name?: string;
      description?: string | null;
      canHaveBoundary?: boolean;
      blockSiblingOverlap?: boolean;
      isActive?: boolean;
    }
  ) {
    const existing = await this.typeRepository.findById(id);
    if (!existing) {
      throw new ResourceNotFoundError("TerritoryType", id);
    }

    if (input.isActive === false) {
      const usage = await this.typeRepository.countTerritoriesUsingType(id);
      if (usage > 0) {
        throw new OperationNotAllowedError(
          "update_territory_type",
          "Cannot deactivate a type that is still used by active territories"
        );
      }
    }

    const type = await this.typeRepository.update(id, {
      ...input,
      name: input.name?.trim(),
      description:
        input.description === undefined ? undefined : input.description?.trim() || null,
    });

    return serializeType(type);
  }
}
