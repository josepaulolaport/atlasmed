import type { CompetitorProductRecord } from "./competitor-product.repository.interface";

export interface ProductEquivalenceRepository {
  /** Competitor products currently linked to `productId` (via `product_equivalences`). */
  findLinkedByProduct(productId: number): Promise<CompetitorProductRecord[]>;

  /** Competitor products not yet linked to `productId` — backs the "add existing" picker. */
  findUnlinkedByProduct(productId: number): Promise<CompetitorProductRecord[]>;

  exists(productId: number, competitorProductId: number): Promise<boolean>;

  link(productId: number, competitorProductId: number, notes?: string | null): Promise<void>;

  /** Deletes the equivalence row. Returns `false` if no such link existed. */
  unlink(productId: number, competitorProductId: number): Promise<boolean>;
}
