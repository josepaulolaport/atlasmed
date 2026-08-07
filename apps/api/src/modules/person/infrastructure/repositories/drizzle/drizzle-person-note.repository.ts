import { personNotes, persons } from "@atlasmed/database";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  PersonNoteRecord,
  PersonNoteRepository,
} from "../../../application/interfaces/person-note.repository.interface";

type NoteRow = typeof personNotes.$inferSelect;

function mapNote(row: NoteRow): PersonNoteRecord {
  return {
    id: row.id,
    userId: row.userId,
    personId: row.personId,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzlePersonNoteRepository implements PersonNoteRepository {
  async findActivePersonById(personId: number): Promise<{ id: number } | null> {
    const [row] = await db
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findByPersonAndUser(
    personId: number,
    userId: number
  ): Promise<PersonNoteRecord[]> {
    const rows = await db
      .select()
      .from(personNotes)
      .where(
        and(eq(personNotes.personId, personId), eq(personNotes.userId, userId))
      )
      .orderBy(desc(personNotes.createdAt));

    return rows.map(mapNote);
  }

  async create(input: {
    personId: number;
    userId: number;
    note: string;
  }): Promise<PersonNoteRecord> {
    const [note] = await db.insert(personNotes).values(input).returning();
    return mapNote(note!);
  }

  async updateOwned(input: {
    noteId: number;
    personId: number;
    userId: number;
    note: string;
  }): Promise<PersonNoteRecord | null> {
    const [row] = await db
      .update(personNotes)
      .set({ note: input.note })
      .where(
        and(
          eq(personNotes.id, input.noteId),
          eq(personNotes.personId, input.personId),
          eq(personNotes.userId, input.userId)
        )
      )
      .returning();
    return row ? mapNote(row) : null;
  }

  async deleteOwned(input: {
    noteId: number;
    personId: number;
    userId: number;
  }): Promise<boolean> {
    const deleted = await db
      .delete(personNotes)
      .where(
        and(
          eq(personNotes.id, input.noteId),
          eq(personNotes.personId, input.personId),
          eq(personNotes.userId, input.userId)
        )
      )
      .returning({ id: personNotes.id });
    return deleted.length > 0;
  }
}
