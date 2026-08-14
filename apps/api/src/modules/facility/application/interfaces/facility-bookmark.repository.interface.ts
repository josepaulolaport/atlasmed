import type { ScopeContext } from "@atlasmed/access";

export interface FacilityBookmarkRecord {
  facilityId: number;
  createdAt: Date;
}

export interface FacilityBookmarkPage {
  items: FacilityBookmarkRecord[];
  total: number;
}

export interface FacilityBookmarkRepository {
  /**
   * Idempotent. A double tap, or a request the app retried on a flaky
   * connection, must not create a second row — the unique index on
   * `(user_id, facility_id)` is what guarantees that, not a prior read.
   */
  add(input: { userId: number; facilityId: number }): Promise<void>;

  /** Idempotent. Removing a bookmark that is not there is a success. */
  remove(input: { userId: number; facilityId: number }): Promise<void>;

  /**
   * The caller's bookmarks, newest first, filtered to what they may currently
   * see.
   *
   * Scope is applied here rather than after paging: filtering a page would
   * return short pages and a `total` that disagrees with the rows. A bookmark
   * for a clinic that left the user's territory simply disappears from the
   * list — the row survives, so it returns if the territory does.
   */
  listForUser(input: {
    userId: number;
    scope: ScopeContext;
    page: number;
    limit: number;
  }): Promise<FacilityBookmarkPage>;

  /**
   * Which of `facilityIds` this user has bookmarked.
   *
   * Lets a detail screen — and later, list cards — render the filled icon
   * without a request per row. Not scope-filtered: the caller has already
   * proven it may see these facilities by being able to name them.
   */
  findBookmarkedIds(input: {
    userId: number;
    facilityIds: number[];
  }): Promise<number[]>;
}
