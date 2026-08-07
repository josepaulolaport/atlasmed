import { and, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  facilities,
  fieldSuggestions,
  roles,
  users,
  type FieldSuggestionStatus,
} from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import type {
  CreateFieldSuggestionInput,
  FieldSuggestionRecord,
  FieldSuggestionRepository,
} from "../../../application/interfaces/field-suggestion.repository.interface";

const submittedBy = alias(users, "field_suggestion_submitted_by");
const resolvedBy = alias(users, "field_suggestion_resolved_by");
const submittedByRole = alias(roles, "field_suggestion_submitted_by_role");

function displayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  username: string | null | undefined
): string {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  return full || username || "Usuário";
}

export class DrizzleFieldSuggestionRepository implements FieldSuggestionRepository {
  private baseSelect() {
    return db
      .select({
        suggestion: fieldSuggestions,
        facilityName: facilities.displayName,
        submittedByFirstName: submittedBy.firstName,
        submittedByLastName: submittedBy.lastName,
        submittedByUsername: submittedBy.username,
        submittedByRole: submittedByRole.name,
        resolvedByFirstName: resolvedBy.firstName,
        resolvedByLastName: resolvedBy.lastName,
        resolvedByUsername: resolvedBy.username,
      })
      .from(fieldSuggestions)
      .innerJoin(facilities, eq(fieldSuggestions.facilityId, facilities.id))
      .innerJoin(submittedBy, eq(fieldSuggestions.submittedByUserId, submittedBy.id))
      .innerJoin(submittedByRole, eq(submittedBy.roleId, submittedByRole.id))
      .leftJoin(resolvedBy, eq(fieldSuggestions.resolvedByUserId, resolvedBy.id));
  }

  private mapSelectRow(
    row: Awaited<ReturnType<typeof this.baseSelect>>[number]
  ): FieldSuggestionRecord {
    return {
      id: row.suggestion.id,
      kind: row.suggestion.kind,
      status: row.suggestion.status,
      facilityId: row.suggestion.facilityId,
      facilityName: row.facilityName ?? "",
      personId: row.suggestion.personId,
      fieldKey: row.suggestion.fieldKey,
      currentValue: row.suggestion.currentValue,
      proposedValue: row.suggestion.proposedValue,
      reason: row.suggestion.reason,
      submittedByUserId: row.suggestion.submittedByUserId,
      submittedByName: displayName(
        row.submittedByFirstName,
        row.submittedByLastName,
        row.submittedByUsername
      ),
      submittedByRole: row.submittedByRole,
      submittedAt: row.suggestion.submittedAt,
      resolvedAt: row.suggestion.resolvedAt,
      resolvedByUserId: row.suggestion.resolvedByUserId,
      resolvedByName: row.suggestion.resolvedByUserId
        ? displayName(
            row.resolvedByFirstName,
            row.resolvedByLastName,
            row.resolvedByUsername
          )
        : null,
      resolutionNote: row.suggestion.resolutionNote,
      createdAt: row.suggestion.createdAt,
      updatedAt: row.suggestion.updatedAt,
    };
  }

  async createWithSupersede(input: CreateFieldSuggestionInput): Promise<{
    suggestion: FieldSuggestionRecord;
    supersededIds: number[];
  }> {
    const supersededIds = await db.transaction(async (tx) => {
      const ids: number[] = [];
      const now = new Date();

      const pendingConditions: SQL[] = [
        eq(fieldSuggestions.facilityId, input.facilityId),
        eq(fieldSuggestions.status, "PENDING"),
      ];

      if (input.kind === "DEACTIVATION") {
        pendingConditions.push(eq(fieldSuggestions.kind, "DEACTIVATION"));
      } else if (input.fieldKey) {
        pendingConditions.push(eq(fieldSuggestions.kind, "FIELD_CHANGE"));
        pendingConditions.push(eq(fieldSuggestions.fieldKey, input.fieldKey));
      }

      const pending = await tx
        .select({ id: fieldSuggestions.id })
        .from(fieldSuggestions)
        .where(and(...pendingConditions));

      if (pending.length > 0) {
        ids.push(...pending.map((p) => p.id));
        await tx
          .update(fieldSuggestions)
          .set({
            status: "REJECTED",
            resolvedAt: now,
            resolvedByUserId: input.submittedByUserId,
            resolutionNote: `Superseded by new suggestion`,
            updatedAt: now,
          })
          .where(inArray(fieldSuggestions.id, ids));
      }

      const [created] = await tx
        .insert(fieldSuggestions)
        .values({
          kind: input.kind,
          status: "PENDING",
          facilityId: input.facilityId,
          fieldKey: input.fieldKey,
          // Cast via text→jsonb so digit-only scalars stay JSON strings in Postgres.
          currentValue: sql`${JSON.stringify(input.currentValue ?? {})}::jsonb`,
          proposedValue:
            input.proposedValue === undefined
              ? null
              : sql`${JSON.stringify(input.proposedValue)}::jsonb`,
          reason: input.reason,
          submittedByUserId: input.submittedByUserId,
          submittedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: fieldSuggestions.id });

      if (!created) {
        throw new Error("Failed to create field suggestion");
      }

      return { ids, createdId: created.id };
    });

    const suggestion = await this.findById(supersededIds.createdId);
    if (!suggestion) {
      throw new Error(`Failed to load created field suggestion ${supersededIds.createdId}`);
    }

    return { suggestion, supersededIds: supersededIds.ids };
  }

  async findById(id: number): Promise<FieldSuggestionRecord | null> {
    const rows = await this.baseSelect().where(eq(fieldSuggestions.id, id)).limit(1);
    const row = rows[0];
    return row ? this.mapSelectRow(row) : null;
  }

  async findAll(input: {
    page: number;
    limit: number;
    status?: FieldSuggestionStatus;
    facilityId?: number;
    facilityIds?: number[];
    submittedByUserId?: number;
  }): Promise<{ suggestions: FieldSuggestionRecord[]; total: number }> {
    const conditions: SQL[] = [];

    if (input.status) {
      conditions.push(eq(fieldSuggestions.status, input.status));
    }
    if (input.facilityId) {
      conditions.push(eq(fieldSuggestions.facilityId, input.facilityId));
    }
    if (input.facilityIds) {
      if (input.facilityIds.length === 0) {
        return { suggestions: [], total: 0 };
      }
      conditions.push(inArray(fieldSuggestions.facilityId, input.facilityIds));
    }
    if (input.submittedByUserId) {
      conditions.push(
        eq(fieldSuggestions.submittedByUserId, input.submittedByUserId)
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (input.page - 1) * input.limit;

    const [rows, totalRows] = await Promise.all([
      this.baseSelect()
        .where(where)
        .orderBy(desc(fieldSuggestions.submittedAt))
        .limit(input.limit)
        .offset(offset),
      db.select({ total: count() }).from(fieldSuggestions).where(where),
    ]);

    return {
      suggestions: rows.map((row) => this.mapSelectRow(row)),
      total: Number(totalRows[0]?.total ?? 0),
    };
  }

  async resolve(
    id: number,
    input: {
      status: "APPROVED" | "REJECTED";
      resolvedByUserId: number;
      resolutionNote?: string | null;
    }
  ): Promise<FieldSuggestionRecord | null> {
    const now = new Date();
    await db
      .update(fieldSuggestions)
      .set({
        status: input.status,
        resolvedAt: now,
        resolvedByUserId: input.resolvedByUserId,
        resolutionNote: input.resolutionNote ?? null,
        updatedAt: now,
      })
      .where(eq(fieldSuggestions.id, id));

    return this.findById(id);
  }
}
