import { facilityNotes } from "@atlasmed/database";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  FacilityNoteRecord,
  FacilityNoteRepository,
} from "../../../application/interfaces/facility-note.repository.interface";

type NoteRow = typeof facilityNotes.$inferSelect;

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
          eq(facilityNotes.userId, userId)
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
