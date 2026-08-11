import type { TerritoryRepository } from "./territory.repository.interface";
import type { TerritoryTypeRepository } from "./territory-type.repository.interface";
import type { TerritorySpatialRepository } from "./territory-spatial.repository.interface";
import type { TerritoryBoundaryWriter } from "./territory-boundary.writer.interface";
import type { ClinicMembershipWriter } from "../services/territory-membership.service";

/**
 * The same collaborators, bound to one transaction.
 *
 * Spec 0009 R1 requires validation and mutation to share a transaction: it is
 * not enough for the destructive step to roll back, because the checks that
 * decide whether it *should* run must see the same snapshot. Reading through
 * these — rather than the module-level pool — is what makes that true.
 */
export interface TransactionalTerritoryDeps {
  territoryRepository: TerritoryRepository;
  territoryTypeRepository: TerritoryTypeRepository;
  spatialRepository: TerritorySpatialRepository;
  boundaryWriter: TerritoryBoundaryWriter;
  /**
   * Spec 0009 R6: derived manager-zone membership is recomputed inside the same
   * transaction that rewrote the geometry, so the two cannot disagree.
   */
  membershipWriter: ClinicMembershipWriter;
  /**
   * Takes a row lock on the territory, so two admins saving the same boundary
   * serialise instead of interleaving. Returns false if the row is gone.
   */
  lockTerritory(territoryId: number): Promise<boolean>;
}

export interface TerritoryTransactionPort {
  run<T>(fn: (deps: TransactionalTerritoryDeps) => Promise<T>): Promise<T>;
}
