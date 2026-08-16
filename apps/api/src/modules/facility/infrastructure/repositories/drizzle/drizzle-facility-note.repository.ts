import { facilityNotes } from "@atlasmed/database";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  FacilityNoteRecord,
  FacilityNoteRepository,
} from "../../../application/interfaces/facility-note.repository.interface";

type NoteRow = typeof facilityNotes.$inferSelect;

/**
 * The previous system's empty state, imported as if it were a note.
 *
 * 1,381 of the 1,437 rows in `facility_notes` are this exact string, one per
 * clinic, all five reps, all stamped the same instant by the bulk load on
 * 2026-08-09. It is not something anybody wrote — it is the label the old
 * screen showed when there was nothing to show, captured as data.
 *
 * Filtered on read rather than deleted, because a read filter is reversible and
 * a delete is not. `scripts/purge-imported-empty-facility-notes.sql` removes
 * them for good once somebody decides that is what they want.
 */
const IMPORTED_EMPTY_NOTE = "Nenhuma observação registrada!";

function mapNote(row: NoteRow): FacilityNoteRecord {
  return {
    id: row.id,
    userId: row.userId,
    facilityId: row.facilityId,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleFacilityNoteRepository implements FacilityNoteRepository {
  async findByFacilityAndUser(
    facilityId: number,
    userId: number
  ): Promise<FacilityNoteRecord[]> {
    const rows = await db
      .select()
      .from(facilityNotes)
      .where(
        and(
          eq(facilityNotes.facilityId, facilityId),
          eq(facilityNotes.userId, userId),
          ne(facilityNotes.note, IMPORTED_EMPTY_NOTE)
        )
      )
      .orderBy(desc(facilityNotes.createdAt));

    return rows.map(mapNote);
  }

  async create(input: {
    facilityId: number;
    userId: number;
    note: string;
  }): Promise<FacilityNoteRecord> {
    const [note] = await db.insert(facilityNotes).values(input).returning();
    return mapNote(note!);
  }

  async updateOwned(input: {
    noteId: number;
    facilityId: number;
    userId: number;
    note: string;
  }): Promise<FacilityNoteRecord | null> {
    const [row] = await db
      .update(facilityNotes)
      .set({ note: input.note })
      .where(
        and(
          eq(facilityNotes.id, input.noteId),
          eq(facilityNotes.facilityId, input.facilityId),
          eq(facilityNotes.userId, input.userId)
        )
      )
      .returning();
    return row ? mapNote(row) : null;
  }

  async deleteOwned(input: {
    noteId: number;
    facilityId: number;
    userId: number;
  }): Promise<boolean> {
    const deleted = await db
      .delete(facilityNotes)
      .where(
        and(
          eq(facilityNotes.id, input.noteId),
          eq(facilityNotes.facilityId, input.facilityId),
          eq(facilityNotes.userId, input.userId)
        )
      )
      .returning({ id: facilityNotes.id });
    return deleted.length > 0;
  }
}
