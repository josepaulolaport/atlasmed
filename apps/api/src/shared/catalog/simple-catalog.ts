import { asc, eq, getTableColumns } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "../../infrastructure/database/db";
import { ResourceNotFoundError, ValidationError } from "../errors";

/**
 * The shape shared by the small reference catalogues an ADMIN maintains
 * (spec 0016 §4.6): an id, a name, an active flag, and at most one extra text
 * column such as an abbreviation or a CNES code.
 *
 * One implementation rather than four near-identical ones. These tables differ
 * only in which columns they carry, and four copies of "list, create, rename,
 * deactivate" would drift — the catalogue this panel exists to fix already has
 * one story about two near-identical tables (spec 0013 §2).
 *
 * Deliberately **not** generalised further. There is no delete (§6.2: every one
 * of these is referenced by operational rows), no pagination (each is a handful
 * of rows), and no search (the client filters what it already has).
 */
export interface SimpleCatalogEntry {
  id: number;
  name: string;
  isActive: boolean;
  /**
   * The table's second column, when it has one — an abbreviation, a CNES code.
   *
   * Always a string over the wire, even when the column is a `bigint`: the
   * client edits one text field either way, and [SimpleCatalogTable.extraKind]
   * says how to write it back.
   */
  extra?: string | null;
}

export interface SimpleCatalogRepository {
  /** Active rows only — what a picker asks for. */
  listActive(): Promise<SimpleCatalogEntry[]>;

  /** Active and inactive — what the admin list asks for (spec 0016 §4). */
  listAll(): Promise<SimpleCatalogEntry[]>;

  create(data: {
    name: string;
    extra?: string | null;
    isActive?: boolean;
  }): Promise<SimpleCatalogEntry>;

  update(
    id: number,
    data: { name?: string; extra?: string | null; isActive?: boolean }
  ): Promise<SimpleCatalogEntry | null>;
}

export interface SimpleCatalogTable {
  table: PgTable;
  id: PgColumn;
  name: PgColumn;
  isActive: PgColumn;
  /** The optional second column (`abbreviation`, `cnes_code`, `cnes_id`, …). */
  extra?: PgColumn;
  /**
   * How to write [extra] back. `healthcare_specialties.cnes_id` is a `bigint`,
   * so handing it the trimmed string would either throw or store something
   * nobody meant; every other one is text.
   */
  extraKind?: "text" | "number";
  /** Whether [extra] must be present on create — `abbreviation` is NOT NULL. */
  extraRequired?: boolean;
}

/**
 * A `SimpleCatalogRepository` over one Drizzle table.
 *
 * Blank text for [extra] is stored as `null`, never `""` — these columns are
 * unique where present, so two rows saved with an empty field would collide on
 * `""` while two saved with `null` would not. The same correctness fix spec 0013
 * §2 made for the product coding columns.
 */
export function createSimpleCatalogRepository(
  columns: SimpleCatalogTable
): SimpleCatalogRepository {
  const select = () => ({
    id: columns.id,
    name: columns.name,
    isActive: columns.isActive,
    ...(columns.extra ? { extra: columns.extra } : {}),
  });

  /**
   * The TypeScript property key for a column, e.g. `isActive` — **not** its SQL
   * name, `is_active`.
   *
   * `insert().values()` and `update().set()` are keyed by the schema's property
   * names. Keying them by `column.name` silently produces an object Drizzle
   * ignores: the statement runs, the row comes back, and the field is simply
   * unchanged. `name` is the one column where the two spellings coincide, which
   * is why it worked and the other two did not.
   */
  const propertyKeys = new Map<PgColumn, string>(
    Object.entries(getTableColumns(columns.table)).map(([key, column]) => [
      column as PgColumn,
      key,
    ])
  );
  const keyOf = (column: PgColumn): string => {
    const key = propertyKeys.get(column);
    if (!key) {
      throw new Error(
        `Column ${column.name} does not belong to the configured table`
      );
    }
    return key;
  };

  /**
   * Blank is absence, and a numeric column gets a number.
   *
   * Throws on text that is not a number for a `number` column, rather than
   * silently storing null — "I typed 12a and it saved with no code" is the kind
   * of quiet wrongness a catalogue never recovers from.
   */
  const coerceExtra = (value: string | null | undefined) => {
    if (value === undefined) return undefined;
    const text = value?.trim();
    if (!text) return null;
    if (columns.extraKind !== "number") return text;
    const parsed = Number(text);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new ValidationError([
        { field: "extra", message: "This field must be a whole number" },
      ]);
    }
    return parsed;
  };

  /**
   * `extra` leaves as a string whatever the column's type, so one client model
   * covers all four catalogues. A `bigint` column reads back as a number, and
   * shipping that would make the field a string on three endpoints and a number
   * on the fourth — a difference no caller has a reason to know about.
   */
  const toEntry = (row: Record<string, unknown>): SimpleCatalogEntry => ({
    id: row.id as number,
    name: row.name as string,
    isActive: row.isActive as boolean,
    ...(columns.extra
      ? { extra: row.extra === null || row.extra === undefined ? null : String(row.extra) }
      : {}),
  });

  return {
    async listActive() {
      const rows = await db
        .select(select())
        .from(columns.table)
        .where(eq(columns.isActive, true))
        .orderBy(asc(columns.name));
      return rows.map(toEntry);
    },

    async listAll() {
      const rows = await db
        .select(select())
        .from(columns.table)
        .orderBy(asc(columns.name));
      return rows.map(toEntry);
    },

    async create(data) {
      const values: Record<string, unknown> = {
        [keyOf(columns.name)]: data.name.trim(),
        [keyOf(columns.isActive)]: data.isActive ?? true,
      };
      if (columns.extra) {
        values[keyOf(columns.extra)] = coerceExtra(data.extra) ?? null;
      }
      const [row] = await db
        .insert(columns.table)
        .values(values as never)
        .returning(select());
      return toEntry(row as Record<string, unknown>);
    },

    async update(id, data) {
      const values: Record<string, unknown> = {};
      if (data.name !== undefined) {
        values[keyOf(columns.name)] = data.name.trim();
      }
      if (data.isActive !== undefined) {
        values[keyOf(columns.isActive)] = data.isActive;
      }
      if (columns.extra && data.extra !== undefined) {
        values[keyOf(columns.extra)] = coerceExtra(data.extra);
      }
      // A PATCH that changed nothing would otherwise generate `SET` with no
      // assignments, which is a syntax error rather than a no-op.
      if (Object.keys(values).length === 0) {
        const [existing] = await db
          .select(select())
          .from(columns.table)
          .where(eq(columns.id, id))
          .limit(1);
        return existing ? toEntry(existing as Record<string, unknown>) : null;
      }

      // Every one of these tables carries `updated_at` with an `$onUpdate`, so
      // Drizzle stamps it; nothing to set by hand.
      const [row] = await db
        .update(columns.table)
        .set(values as never)
        .where(eq(columns.id, id))
        .returning(select());
      return row ? toEntry(row as Record<string, unknown>) : null;
    },
  };
}

/** Lists one catalogue. `includeInactive` is the admin's view (spec 0016 §4). */
export class ListSimpleCatalogUseCase {
  constructor(private readonly repository: SimpleCatalogRepository) {}

  async execute(input: { includeInactive?: boolean } = {}) {
    const rows = input.includeInactive
      ? await this.repository.listAll()
      : await this.repository.listActive();
    return { data: rows };
  }
}

export class CreateSimpleCatalogUseCase {
  constructor(
    private readonly repository: SimpleCatalogRepository,
    private readonly options: { resource: string; extraRequired?: boolean } = {
      resource: "CatalogEntry",
    }
  ) {}

  async execute(input: { name: string; extra?: string | null; isActive?: boolean }) {
    const name = input.name.trim();
    if (!name) {
      throw new ValidationError([{ field: "name", message: "Name is required" }]);
    }
    if (this.options.extraRequired && !input.extra?.trim()) {
      throw new ValidationError([
        { field: "extra", message: "This catalog requires its second field" },
      ]);
    }
    return this.repository.create({ ...input, name });
  }
}

export class UpdateSimpleCatalogUseCase {
  constructor(
    private readonly repository: SimpleCatalogRepository,
    private readonly options: { resource: string } = { resource: "CatalogEntry" }
  ) {}

  async execute(input: {
    id: number;
    name?: string;
    extra?: string | null;
    isActive?: boolean;
  }) {
    const { id, ...fields } = input;
    if (fields.name !== undefined && !fields.name.trim()) {
      throw new ValidationError([{ field: "name", message: "Name is required" }]);
    }
    const row = await this.repository.update(id, fields);
    if (!row) throw new ResourceNotFoundError(this.options.resource, id);
    return row;
  }
}
