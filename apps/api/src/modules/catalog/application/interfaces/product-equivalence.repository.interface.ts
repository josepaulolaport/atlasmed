import type { CompetitorProductRecord } from "./competitor-product.repository.interface";

export interface ProductEquivalenceRepository {
  /** Competitor products currently linked to `productId` (via `product_equivalences`). */
  findLinkedByProduct(productId: string): Promise<CompetitorProductRecord[]>;

  /** Competitor products not yet linked to `productId` — backs the "add existing" picker. */
  findUnlinkedByProduct(productId: string): Promise<CompetitorProductRecord[]>;

  exists(productId: string, competitorProductId: string): Promise<boolean>;

  link(productId: string, competitorProductId: string, notes?: string | null): Promise<void>;

  /** Deletes the equivalence row. Returns `false` if no such link existed. */
  unlink(productId: string, competitorProductId: string): Promise<boolean>;
}
