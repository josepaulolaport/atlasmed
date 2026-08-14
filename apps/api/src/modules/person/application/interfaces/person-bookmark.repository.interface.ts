import type { ScopeContext } from "@atlasmed/access";

export interface PersonBookmarkRecord {
  personId: number;
  createdAt: Date;
}

export interface PersonBookmarkPage {
  items: PersonBookmarkRecord[];
  total: number;
}

export interface PersonBookmarkRepository {
  /** Active (non-deleted) person, or null. */
  findActivePersonById(personId: number): Promise<{ id: number } | null>;

  /**
   * Whether this doctor is attached to any clinic the caller can see.
   *
   * `person-note.use-cases.ts` deliberately skips territory scope for notes.
   * Bookmarks diverge: a note you cannot see does no harm, but a bookmark that
   * saves successfully and then never appears in your list is a bug report
   * waiting to happen. Both halves of this feature refuse to save what the
   * caller cannot see.
   */
  isPersonInScope(input: {
    personId: number;
    scope: ScopeContext;
  }): Promise<boolean>;
  /** Idempotent — see the unique index on `(user_id, person_id)`. */
  add(input: { userId: number; personId: number }): Promise<void>;

  /** Idempotent. Removing a bookmark that is not there is a success. */
  remove(input: { userId: number; personId: number }): Promise<void>;

  /**
   * The caller's bookmarked doctors, newest first, filtered to what they may
   * currently see.
   *
   * A professional has no scope of their own — visibility is inherited from the
   * clinics they are attached to, which is how `list-healthcare-professionals`
   * already works. So a doctor stays visible while *any* of their clinics is in
   * the caller's scope, and drops out when the last one leaves.
   */
  listForUser(input: {
    userId: number;
    scope: ScopeContext;
    page: number;
    limit: number;
  }): Promise<PersonBookmarkPage>;

  /** Which of `personIds` this user has bookmarked. */
  findBookmarkedIds(input: {
    userId: number;
    personIds: number[];
  }): Promise<number[]>;
}
