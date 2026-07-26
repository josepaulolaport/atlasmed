/**
 * Local seed: manager zone + REP patches from existing consultant clinic books
 * (convex hull + buffer). No invented consultant assigns.
 *
 * Prefer Excel-book REPs (Adriana / Laudo / Luis / Raquel + others with books).
 * Codes: DEMO-CLINIC-*. Local DATABASE_URL only.
 *
 *   bun run db:seed:sp-territories
 *
 * Env:
 *   SEED_MANAGER_EMAIL (default manager@atlasmed.com.br)
 *   SEED_MANAGER_PASSWORD (only if creating a new manager)
 *   SEED_TERRITORY_REP_LIMIT (default 8)
 */
import "dotenv/config";
import { hash } from "argon2";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  businessVerticals,
  roles,
  territories,
  territoryTypes,
  userTerritoryAssignments,
  userVerticalAssignments,
  users,
} from "@atlasmed/database";
import { db } from "../infrastructure/database/db";
import {
  territoryMembershipService,
  territoryRepositories,
} from "../modules/territory/composition";
import type { GeoJsonGeometry } from "../modules/territory/application/interfaces/territory-spatial.repository.interface";

const CODE_PREFIX = "DEMO-CLINIC";
const LEGACY_PREFIXES = ["DEMO-CLINIC-", "DEMO-SP-"] as const;

/** Excel-book REPs first (filenames under atlasmed/excels). */
const PREFERRED_REP_EMAILS = [
  "adriana@atlasmed.com.br",
  "laudo@atlasmed.com.br",
  "luis.stelet@atlasmed.com.br",
  "raquel@atlasmed.com.br",
] as const;

function assertLocalDatabaseUrl(url: string): void {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local");
  if (!isLocal) {
    throw new Error(
      `seed refused: host "${host}" is not local. Do not run demo territory geometry against shared/prod DBs.`,
    );
  }
}

function sqlInStrings(values: readonly string[]) {
  if (values.length === 0) return sql`NULL`;
  return sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );
}

async function requireTypeId(slug: string): Promise<string> {
  const [row] = await db
    .select({ id: territoryTypes.id })
    .from(territoryTypes)
    .where(eq(territoryTypes.slug, slug))
    .limit(1);
  if (!row) {
    throw new Error(`Territory type "${slug}" missing — run db:migrate (0028) first`);
  }
  return row.id;
}

async function requireVerticalId(code: string): Promise<string> {
  const [row] = await db
    .select({ id: businessVerticals.id })
    .from(businessVerticals)
    .where(eq(businessVerticals.code, code))
    .limit(1);
  if (!row) throw new Error(`Business vertical "${code}" missing`);
  return row.id;
}

async function ensureManager(params: {
  email: string;
  password: string;
  ortopediaId: string;
}): Promise<{ id: string; email: string; created: boolean }> {
  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, "MANAGER"))
    .limit(1);
  if (!role) throw new Error("MANAGER role missing");

  const [existing] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, params.email))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        roleId: role.id,
        status: "ACTIVE",
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));

    const [uva] = await db
      .select({ id: userVerticalAssignments.id })
      .from(userVerticalAssignments)
      .where(
        and(
          eq(userVerticalAssignments.userId, existing.id),
          eq(userVerticalAssignments.verticalId, params.ortopediaId),
        ),
      )
      .limit(1);
    if (!uva) {
      await db.insert(userVerticalAssignments).values({
        userId: existing.id,
        verticalId: params.ortopediaId,
      });
    }
    return { id: existing.id, email: existing.email, created: false };
  }

  const passwordHash = await hash(params.password);
  const username = params.email.split("@")[0]!.replace(/[^a-zA-Z0-9._-]/g, ".");
  const [created] = await db
    .insert(users)
    .values({
      email: params.email,
      username,
      passwordHash,
      firstName: "Gerente",
      lastName: "Territórios",
      roleId: role.id,
      status: "ACTIVE",
      emailVerified: true,
    })
    .returning({ id: users.id, email: users.email });

  await db.insert(userVerticalAssignments).values({
    userId: created!.id,
    verticalId: params.ortopediaId,
  });

  return { id: created!.id, email: created!.email, created: true };
}

async function clearDemoTerritories(): Promise<void> {
  const legacy = await db
    .select({ id: territories.id })
    .from(territories)
    .where(
      sql`${territories.code} LIKE ${`${LEGACY_PREFIXES[0]}%`} OR ${territories.code} LIKE ${`${LEGACY_PREFIXES[1]}%`}`,
    );
  const ids = legacy.map((row) => row.id);
  if (ids.length === 0) return;

  await db
    .delete(userTerritoryAssignments)
    .where(inArray(userTerritoryAssignments.territoryId, ids));

  await db.execute(sql`
    UPDATE public.facility_vertical_profiles
    SET territory_id = NULL, updated_at = now()
    WHERE territory_id IN (${sqlInStrings(ids)})
  `);
  await db.delete(territories).where(inArray(territories.id, ids));
}

async function upsertTerritory(params: {
  code: string;
  name: string;
  slug: string;
  verticalId: string;
  territoryTypeId: string;
  managerTerritoryId?: string | null;
}): Promise<string> {
  const [existing] = await db
    .select({ id: territories.id })
    .from(territories)
    .where(
      and(eq(territories.verticalId, params.verticalId), eq(territories.code, params.code)),
    )
    .limit(1);

  if (existing) {
    await db
      .update(territories)
      .set({
        name: params.name,
        slug: params.slug,
        territoryTypeId: params.territoryTypeId,
        managerTerritoryId: params.managerTerritoryId ?? null,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(territories.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db
    .insert(territories)
    .values({
      name: params.name,
      slug: params.slug,
      code: params.code,
      verticalId: params.verticalId,
      territoryTypeId: params.territoryTypeId,
      managerTerritoryId: params.managerTerritoryId ?? null,
      isActive: true,
    })
    .returning({ id: territories.id });
  return inserted!.id;
}

async function assignUserToTerritory(params: {
  userId: string;
  territoryId: string;
  assignedBy: string;
}): Promise<void> {
  const [existing] = await db
    .select({ id: userTerritoryAssignments.id })
    .from(userTerritoryAssignments)
    .where(
      and(
        eq(userTerritoryAssignments.userId, params.userId),
        eq(userTerritoryAssignments.territoryId, params.territoryId),
      ),
    )
    .limit(1);
  if (existing) return;
  await db.insert(userTerritoryAssignments).values({
    userId: params.userId,
    territoryId: params.territoryId,
    assignedBy: params.assignedBy,
  });
}

async function linkRepToManager(params: {
  repUserId: string;
  managerId: string;
  ortopediaId: string;
}): Promise<void> {
  await db
    .update(users)
    .set({ managerId: params.managerId, updatedAt: new Date() })
    .where(eq(users.id, params.repUserId));

  const [uva] = await db
    .select({ id: userVerticalAssignments.id })
    .from(userVerticalAssignments)
    .where(
      and(
        eq(userVerticalAssignments.userId, params.repUserId),
        eq(userVerticalAssignments.verticalId, params.ortopediaId),
      ),
    )
    .limit(1);

  if (uva) {
    await db
      .update(userVerticalAssignments)
      .set({ managerId: params.managerId, updatedAt: new Date() })
      .where(eq(userVerticalAssignments.id, uva.id));
  } else {
    await db.insert(userVerticalAssignments).values({
      userId: params.repUserId,
      verticalId: params.ortopediaId,
      managerId: params.managerId,
    });
  }
}

type RepBook = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  clinicCount: number;
  primaryState: string;
  primaryCity: string;
};

async function loadRepBooks(limit: number): Promise<RepBook[]> {
  const preferred = await db.execute<{
    user_id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    clinic_count: number;
    primary_state: string;
    primary_city: string;
  }>(sql`
    SELECT
      u.id AS user_id,
      u.email,
      u.first_name,
      u.last_name,
      count(*)::int AS clinic_count,
      mode() WITHIN GROUP (ORDER BY f.state) AS primary_state,
      mode() WITHIN GROUP (ORDER BY f.city) AS primary_city
    FROM public.users u
    JOIN public.roles r ON r.id = u.role_id AND r.name = 'REP'
    JOIN public.facility_consultant_assignments fca
      ON fca.user_id = u.id AND fca.ended_at IS NULL
    JOIN public.facilities f ON f.id = fca.facility_id
    WHERE u.status = 'ACTIVE'
      AND f.location IS NOT NULL
      AND f.state IS NOT NULL
      AND u.email IN (${sqlInStrings(PREFERRED_REP_EMAILS)})
    GROUP BY u.id
    HAVING count(*) >= 10
  `);

  const byEmail = new Map(
    (Array.isArray(preferred) ? preferred : []).map((row) => [row.email, row]),
  );
  const ordered: RepBook[] = [];
  for (const email of PREFERRED_REP_EMAILS) {
    const row = byEmail.get(email);
    if (!row) continue;
    ordered.push({
      userId: row.user_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      clinicCount: Number(row.clinic_count),
      primaryState: row.primary_state,
      primaryCity: row.primary_city,
    });
  }
  // Larger books first so overlapping hulls (e.g. RJ) carve remaining space fairly.
  ordered.sort((a, b) => b.clinicCount - a.clinicCount);

  if (ordered.length >= limit) return ordered.slice(0, limit);

  // Fill remaining slots with largest other REP books (still real consultants).
  const extras = await db.execute<{
    user_id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    clinic_count: number;
    primary_state: string;
    primary_city: string;
  }>(sql`
    SELECT
      u.id AS user_id,
      u.email,
      u.first_name,
      u.last_name,
      count(*)::int AS clinic_count,
      mode() WITHIN GROUP (ORDER BY f.state) AS primary_state,
      mode() WITHIN GROUP (ORDER BY f.city) AS primary_city
    FROM public.users u
    JOIN public.roles r ON r.id = u.role_id AND r.name = 'REP'
    JOIN public.facility_consultant_assignments fca
      ON fca.user_id = u.id AND fca.ended_at IS NULL
    JOIN public.facilities f ON f.id = fca.facility_id
    WHERE u.status = 'ACTIVE'
      AND f.location IS NOT NULL
      AND f.state IS NOT NULL
      AND u.email NOT IN (${sqlInStrings(PREFERRED_REP_EMAILS)})
    GROUP BY u.id
    HAVING count(*) >= 40
    ORDER BY count(*) DESC
    LIMIT ${Math.max(limit - ordered.length, 0)}
  `);

  for (const row of Array.isArray(extras) ? extras : []) {
    ordered.push({
      userId: row.user_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      clinicCount: Number(row.clinic_count),
      primaryState: row.primary_state,
      primaryCity: row.primary_city,
    });
  }
  return ordered.slice(0, limit);
}

async function buildRepPatchGeoJson(params: {
  userId: string;
  primaryState: string;
}): Promise<{ geojson: GeoJsonGeometry; clinicCount: number } | null> {
  // Overlapping hulls are OK — excel books share metros (RJ). REP clinic
  // visibility stays consultant-based; patch geo is for manager coverage / map.
  const rows = await db.execute<{
    geojson: string;
    clinic_count: number;
  }>(sql`
    WITH pts AS (
      SELECT f.location::geometry AS geom
      FROM public.facility_consultant_assignments fca
      JOIN public.facilities f ON f.id = fca.facility_id
      WHERE fca.user_id = ${params.userId}
        AND fca.ended_at IS NULL
        AND f.location IS NOT NULL
        AND f.state = ${params.primaryState}
    ),
    hull AS (
      SELECT
        ST_Buffer(ST_ConvexHull(ST_Collect(geom))::geography, 5000)::geometry AS geom,
        count(*)::int AS clinic_count
      FROM pts
    )
    SELECT
      ST_AsGeoJSON(ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3)))::text AS geojson,
      clinic_count
    FROM hull
    WHERE geom IS NOT NULL
      AND NOT ST_IsEmpty(geom)
      AND ST_Area(geom::geography) > 1
  `);

  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row?.geojson) return null;
  return {
    geojson: JSON.parse(row.geojson) as GeoJsonGeometry,
    clinicCount: Number(row.clinic_count),
  };
}

async function buildManagerZoneGeoJson(patchIds: string[]): Promise<GeoJsonGeometry> {
  const rows = await db.execute<{ geojson: string }>(sql`
    WITH unioned AS (
      SELECT ST_Buffer(
        ST_UnaryUnion(ST_Collect(boundary))::geography,
        2000
      )::geometry AS geom
      FROM public.territories
      WHERE id IN (${sqlInStrings(patchIds)})
        AND boundary IS NOT NULL
    )
    SELECT ST_AsGeoJSON(ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3)))::text AS geojson
    FROM unioned
    WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
  `);
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row?.geojson) {
    throw new Error("Failed to build manager zone from patch union");
  }
  return JSON.parse(row.geojson) as GeoJsonGeometry;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  assertLocalDatabaseUrl(databaseUrl);

  console.log("🌱 Seeding territories from real consultant clinic books...");

  const managerZoneTypeId = await requireTypeId("manager_zone");
  const patchTypeId = await requireTypeId("patch");
  const ortopediaId = await requireVerticalId("ORTOPEDIA");

  console.log("   Clearing previous DEMO-* territories (assigns untouched)...");
  await clearDemoTerritories();

  const managerEmail = process.env.SEED_MANAGER_EMAIL || "manager@atlasmed.com.br";
  const managerPassword = process.env.SEED_MANAGER_PASSWORD || "ManagerSp123!";
  const manager = await ensureManager({
    email: managerEmail,
    password: managerPassword,
    ortopediaId,
  });
  console.log(
    `   ${manager.created ? "Created" : "Using"} manager ${manager.email} (${manager.id})`,
  );

  const limit = Number(process.env.SEED_TERRITORY_REP_LIMIT || "8");
  const books = await loadRepBooks(Number.isFinite(limit) ? limit : 8);
  if (books.length === 0) {
    throw new Error("No REPs with enough geocoded consultant clinics");
  }

  console.log("   REP books:");
  for (const book of books) {
    console.log(
      `     - ${book.email}: ${book.clinicCount} clinics → ${book.primaryState}/${book.primaryCity}`,
    );
  }

  const zoneId = await upsertTerritory({
    code: `${CODE_PREFIX}-ZONE`,
    name: "Zona gerente (livros comerciais)",
    slug: "demo-clinic-manager-zone",
    verticalId: ortopediaId,
    territoryTypeId: managerZoneTypeId,
  });

  const patchIds: string[] = [];
  const patchSummaries: Array<{ code: string; email: string; patchId: string }> = [];

  for (const [index, book] of books.entries()) {
    const shape = await buildRepPatchGeoJson({
      userId: book.userId,
      primaryState: book.primaryState,
    });
    if (!shape) {
      console.warn(`   ⚠ Skip ${book.email}: no usable hull in ${book.primaryState}`);
      continue;
    }

    const shortName =
      [book.firstName, book.lastName].filter(Boolean).join(" ").trim() || book.email;
    const code = `${CODE_PREFIX}-${String(index + 1).padStart(2, "0")}-${book.primaryState}`;
    const slug = `demo-clinic-${index + 1}-${book.primaryState.toLowerCase()}-${book.email
      .split("@")[0]!
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()}`;

    const patchId = await upsertTerritory({
      code,
      name: `${book.primaryState} — ${shortName}`,
      slug: slug.slice(0, 80),
      verticalId: ortopediaId,
      territoryTypeId: patchTypeId,
      managerTerritoryId: zoneId,
    });

    await territoryRepositories.spatial.saveBoundary(patchId, shape.geojson, {
      repairInvalid: true,
    });
    await territoryRepositories.spatial.updateBoundaryMetadata(patchId);

    await assignUserToTerritory({
      userId: book.userId,
      territoryId: patchId,
      assignedBy: manager.id,
    });
    await linkRepToManager({
      repUserId: book.userId,
      managerId: manager.id,
      ortopediaId,
    });

    patchIds.push(patchId);
    patchSummaries.push({ code, email: book.email, patchId });
    console.log(
      `   Patch ${code}: ${book.email} — hull of ${shape.clinicCount} clinics (${book.primaryCity})`,
    );
  }

  if (patchIds.length === 0) {
    throw new Error("No patches created");
  }

  const zoneGeo = await buildManagerZoneGeoJson(patchIds);
  await territoryRepositories.spatial.saveBoundary(zoneId, zoneGeo, { repairInvalid: true });
  await territoryRepositories.spatial.updateBoundaryMetadata(zoneId);
  await assignUserToTerritory({
    userId: manager.id,
    territoryId: zoneId,
    assignedBy: manager.id,
  });
  console.log(`   Zone ${CODE_PREFIX}-ZONE covers ${patchIds.length} patches`);

  for (const patch of patchSummaries) {
    const { processed } = await territoryMembershipService.recomputeForTerritoryBoundary(
      patch.patchId,
    );
    console.log(`      recompute ${patch.code}: ${processed} clinics in bbox`);
  }

  const coverage = await db.execute<{
    email: string;
    consultant_clinics: number;
    in_own_patch: number;
  }>(sql`
    SELECT
      u.email,
      count(*)::int AS consultant_clinics,
      count(*) FILTER (WHERE fvp.territory_id = uta.territory_id)::int AS in_own_patch
    FROM public.users u
    JOIN public.user_territory_assignments uta ON uta.user_id = u.id
    JOIN public.territories t ON t.id = uta.territory_id AND t.code LIKE ${`${CODE_PREFIX}-%`}
    JOIN public.territory_types tt ON tt.id = t.territory_type_id AND tt.slug = 'patch'
    JOIN public.facility_consultant_assignments fca
      ON fca.user_id = u.id AND fca.ended_at IS NULL
    JOIN public.facility_vertical_profiles fvp
      ON fvp.facility_id = fca.facility_id
     AND fvp.vertical_id = ${ortopediaId}
    GROUP BY u.email
    ORDER BY u.email
  `);

  console.log("\n✅ Done");
  console.log(`   Manager: ${manager.email}`);
  for (const row of Array.isArray(coverage) ? coverage : []) {
    console.log(
      `   ${row.email}: ${row.in_own_patch}/${row.consultant_clinics} consultant clinics inside own patch`,
    );
  }
}

main()
  .then(async () => {
    await db.$client.end({ timeout: 2 }).catch(() => undefined);
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await db.$client.end({ timeout: 2 }).catch(() => undefined);
    process.exit(1);
  });
