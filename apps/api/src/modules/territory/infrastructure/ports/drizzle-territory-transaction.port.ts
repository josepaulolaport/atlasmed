import { sql } from "drizzle-orm";
import { db } from "../../../../infrastructure/database/db";
import type {
  TerritoryTransactionPort,
  TransactionalTerritoryDeps,
} from "../../application/interfaces/territory-transaction.port.interface";
import { DrizzleTerritoryRepository } from "../repositories/drizzle/drizzle-territory.repository";
import { DrizzleTerritoryTypeRepository } from "../repositories/drizzle/drizzle-territory-type.repository";
import { DrizzleTerritorySpatialRepository } from "../repositories/drizzle/drizzle-territory-spatial.repository";
import { DrizzleTerritoryBoundaryWriter } from "../adapters/drizzle-territory-boundary.writer";

/**
 * Runs a unit of territory work inside one transaction, handing the caller
 * collaborators bound to it.
 *
 * Spec 0009 R1. Before this existed, `saveBoundary` validated through the
 * connection pool and then mutated inside a separate transaction — so the
 * checks and the write saw different snapshots, and a concurrent save landing
 * between them could commit a boundary that orphaned a patch. The transaction
 * has to start before the first read, not before the first write.
 */
export class DrizzleTerritoryTransactionPort implements TerritoryTransactionPort {
  async run<T>(fn: (deps: TransactionalTerritoryDeps) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      const deps: TransactionalTerritoryDeps = {
        territoryRepository: new DrizzleTerritoryRepository(tx),
        territoryTypeRepository: new DrizzleTerritoryTypeRepository(tx),
        spatialRepository: new DrizzleTerritorySpatialRepository(tx),
        boundaryWriter: new DrizzleTerritoryBoundaryWriter(tx),
        lockTerritory: async (territoryId: number) => {
          // FOR UPDATE, not an advisory lock: it blocks a second saver on the
          // same territory until this transaction ends, and releases on both
          // commit and rollback without any cleanup path to forget.
          const rows = (await tx.execute(sql`
            SELECT id FROM territories WHERE id = ${territoryId} FOR UPDATE
          `)) as Array<{ id: number }>;
          return rows.length > 0;
        },
      };

      return fn(deps);
    });
  }
}
