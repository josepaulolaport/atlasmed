import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { FacilityRepository } from "../../../facility/application/interfaces/facility.repository.interface";
import type { RegistryReadRepository } from "../interfaces/registry-read.repository.interface";
import { buildRegistryAddress } from "./registry-projection.service";

interface Dependencies {
  facilityRepository: FacilityRepository;
  registryReadRepository: RegistryReadRepository;
}

export class RegistryReadService {
  constructor(private readonly deps: Dependencies) {}

  private async resolveRegistryFacilityId(
    facilityId: string,
    scope: ScopeContext
  ): Promise<string | null> {
    assertResourceInScope(scope, "facility", facilityId);

    const facility = await this.deps.facilityRepository.findById(facilityId);
    if (!facility?.externalSourceId) {
      return null;
    }

    return facility.externalSourceId;
  }

  async getRegistryFacility(input: { facilityId: string; scope: ScopeContext }) {
    const registryFacilityId = await this.resolveRegistryFacilityId(
      input.facilityId,
      input.scope
    );

    if (!registryFacilityId) {
      return null;
    }

    const projection = await this.deps.registryReadRepository.findFacilityByRegistryId(
      registryFacilityId
    );

    if (!projection) {
      return null;
    }

    return {
      ...projection,
      formattedAddress: buildRegistryAddress(projection),
      source: "registry" as const,
    };
  }

  async getRegistryProfessionals(input: { facilityId: string; scope: ScopeContext }) {
    const registryFacilityId = await this.resolveRegistryFacilityId(
      input.facilityId,
      input.scope
    );

    if (!registryFacilityId) {
      return { data: [] };
    }

    const professionals = await this.deps.registryReadRepository.findProfessionalsByFacility(
      registryFacilityId
    );

    return { data: professionals };
  }

  async getRegistryRepresentatives(input: { facilityId: string; scope: ScopeContext }) {
    const registryFacilityId = await this.resolveRegistryFacilityId(
      input.facilityId,
      input.scope
    );

    if (!registryFacilityId) {
      return { data: [] };
    }

    const representatives = await this.deps.registryReadRepository.findRepresentativesByFacility(
      registryFacilityId
    );

    return { data: representatives };
  }
}
