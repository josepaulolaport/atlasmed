import type { CompetitorProductRecord } from "./competitor-product.repository.interface";

/**
 * Equivalences are written in one direction only: from one of our products to
 * the competitor's (spec 0016 §4.3, §6.5). A draft also exposed the reverse —
 * open a competitor product, attach ours — and it was dropped: an equivalence is
 * a statement about one of our products ("this is what competes with it"), and
 * two places to make the same statement is how the two come to disagree.
 */
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
