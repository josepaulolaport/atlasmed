/**
 * Local/dev seed: SP manager zone + rep patches + manager + REP UTAs + membership recompute.
 *
 * Idempotent on territory codes DEMO-SP-*. Local DATABASE_URL only.
 *
 * Usage (from apps/api):
 *   bun src/scripts/seed-sp-demo-territories.ts
 *
 * Optional env:
 *   SEED_MANAGER_EMAIL (default gerente.sp@atlasmed.com.br)
 *   SEED_MANAGER_PASSWORD (default ManagerSp123!)
 */
import "dotenv/config";
import { hash } from "argon2";
import { and, eq, sql } from "drizzle-orm";
import {
  businessVerticals,
  facilityConsultantAssignments,
  facilityVerticalProfiles,
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

const CODE_PREFIX = "DEMO-SP";

type Rect = { minLng: number; minLat: number; maxLng: number; maxLat: number };

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
      `seed-sp-demo-territories refused: host "${host}" is not local. Demo geometry must not hit shared/prod DBs.`,
    );
  }
}

function rectMultiPolygon(rect: Rect) {
  const { minLng, minLat, maxLng, maxLat } = rect;
  return {
    type: "MultiPolygon" as const,
    coordinates: [
      [
        [
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat],
        ],
      ],
    ],
  };
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
  if (!row) {
    throw new Error(`Business vertical "${code}" missing`);
  }
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
        firstName: "Gerente",
        lastName: "SP Capital",
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
      lastName: "SP Capital",
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

/** REP clinic list is consultant-only — seed a sample of profiled clinics in each patch. */
async function ensureConsultantSample(params: {
  repUserId: string;
  territoryId: string;
  ortopediaId: string;
  assignedBy: string;
  limit: number;
}): Promise<number> {
  const candidates = await db
    .select({ facilityId: facilityVerticalProfiles.facilityId })
    .from(facilityVerticalProfiles)
    .where(
      and(
        eq(facilityVerticalProfiles.verticalId, params.ortopediaId),
        eq(facilityVerticalProfiles.territoryId, params.territoryId),
        eq(facilityVerticalProfiles.isActive, true),
      ),
    )
    .limit(params.limit);

  let created = 0;
  for (const row of candidates) {
    const [active] = await db
      .select({ id: facilityConsultantAssignments.id, userId: facilityConsultantAssignments.userId })
      .from(facilityConsultantAssignments)
      .where(
        and(
          eq(facilityConsultantAssignments.facilityId, row.facilityId),
          eq(facilityConsultantAssignments.verticalId, params.ortopediaId),
          sql`${facilityConsultantAssignments.endedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (active?.userId === params.repUserId) {
      created += 1;
      continue;
    }

    if (active) {
      // Demo seed only: reassign a sample so REPs see clinics (list = consultant-only).
      await db
        .update(facilityConsultantAssignments)
        .set({
          endedAt: new Date(),
          endReason: "demo_sp_territory_seed_reassign",
          updatedAt: new Date(),
        })
        .where(eq(facilityConsultantAssignments.id, active.id));
    }

    await db.insert(facilityConsultantAssignments).values({
      facilityId: row.facilityId,
      userId: params.repUserId,
      verticalId: params.ortopediaId,
      assignedByUserId: params.assignedBy,
    });
    created += 1;
  }
  return created;
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

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  assertLocalDatabaseUrl(databaseUrl);

  console.log("🌱 Seeding SP demo territories (Ortopedia)...");

  const managerZoneTypeId = await requireTypeId("manager_zone");
  const patchTypeId = await requireTypeId("patch");
  const ortopediaId = await requireVerticalId("ORTOPEDIA");

  const managerEmail = process.env.SEED_MANAGER_EMAIL || "gerente.sp@atlasmed.com.br";
  const managerPassword = process.env.SEED_MANAGER_PASSWORD || "ManagerSp123!";
  const manager = await ensureManager({
    email: managerEmail,
    password: managerPassword,
    ortopediaId,
  });
  console.log(
    `   ${manager.created ? "Created" : "Updated"} manager ${manager.email} (${manager.id})`,
  );

  // Manager zone covers dense SP capital + nearby metro west/south (approx).
  const zoneRect: Rect = {
    minLng: -46.82,
    minLat: -23.78,
    maxLng: -46.4,
    maxLat: -23.4,
  };

  const zoneId = await upsertTerritory({
    code: `${CODE_PREFIX}-ZONE`,
    name: "SP Capital (gerente)",
    slug: "demo-sp-capital-zone",
    verticalId: ortopediaId,
    territoryTypeId: managerZoneTypeId,
  });

  await territoryRepositories.spatial.saveBoundary(zoneId, rectMultiPolygon(zoneRect));
  await territoryRepositories.spatial.updateBoundaryMetadata(zoneId);
  console.log(`   Zone ${CODE_PREFIX}-ZONE → ${zoneId}`);

  await assignUserToTerritory({
    userId: manager.id,
    territoryId: zoneId,
    assignedBy: manager.id,
  });

  const patches: Array<{
    code: string;
    name: string;
    slug: string;
    rect: Rect;
    repEmail: string;
  }> = [
    {
      code: `${CODE_PREFIX}-CENTRO`,
      name: "SP Centro",
      slug: "demo-sp-centro",
      rect: { minLng: -46.68, minLat: -23.58, maxLng: -46.6, maxLat: -23.52 },
      repEmail: "rep@atlasmed.com.br",
    },
    {
      code: `${CODE_PREFIX}-ZONA-SUL`,
      name: "SP Zona Sul",
      slug: "demo-sp-zona-sul",
      rect: { minLng: -46.72, minLat: -23.72, maxLng: -46.6, maxLat: -23.58 },
      repEmail: "adriana@atlasmed.com.br",
    },
    {
      code: `${CODE_PREFIX}-ZONA-OESTE`,
      name: "SP Zona Oeste",
      slug: "demo-sp-zona-oeste",
      rect: { minLng: -46.8, minLat: -23.62, maxLng: -46.68, maxLat: -23.5 },
      repEmail: "laudo@atlasmed.com.br",
    },
    {
      code: `${CODE_PREFIX}-ZONA-NORTE`,
      name: "SP Zona Norte",
      slug: "demo-sp-zona-norte",
      rect: { minLng: -46.68, minLat: -23.52, maxLng: -46.52, maxLat: -23.42 },
      repEmail: "raquel@atlasmed.com.br",
    },
    {
      code: `${CODE_PREFIX}-ZONA-LESTE`,
      name: "SP Zona Leste / ABC",
      slug: "demo-sp-zona-leste",
      rect: { minLng: -46.6, minLat: -23.7, maxLng: -46.45, maxLat: -23.55 },
      repEmail: "luis.stelet@atlasmed.com.br",
    },
  ];

  for (const patch of patches) {
    const patchId = await upsertTerritory({
      code: patch.code,
      name: patch.name,
      slug: patch.slug,
      verticalId: ortopediaId,
      territoryTypeId: patchTypeId,
      managerTerritoryId: zoneId,
    });
    await territoryRepositories.spatial.saveBoundary(patchId, rectMultiPolygon(patch.rect));
    await territoryRepositories.spatial.updateBoundaryMetadata(patchId);

    const { processed } = await territoryMembershipService.recomputeForTerritoryBoundary(patchId);
    console.log(`   Patch ${patch.code}: membership recompute ${processed} clinics in bbox`);

    const [rep] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, patch.repEmail))
      .limit(1);

    if (!rep) {
      console.warn(`   ⚠ REP ${patch.repEmail} not found — patch ${patch.code} created without UTA`);
      continue;
    }

    await assignUserToTerritory({
      userId: rep.id,
      territoryId: patchId,
      assignedBy: manager.id,
    });
    await linkRepToManager({
      repUserId: rep.id,
      managerId: manager.id,
      ortopediaId,
    });
    const consultants = await ensureConsultantSample({
      repUserId: rep.id,
      territoryId: patchId,
      ortopediaId,
      assignedBy: manager.id,
      limit: 40,
    });
    console.log(`      → ${rep.email} (UTA + ${consultants} consultant assigns)`);
  }

  const summary = await db.execute<{
    territories: string;
    utas: string;
    profiles_with_territory: string;
  }>(sql`
    SELECT
      (SELECT count(*)::text FROM public.territories WHERE code LIKE ${`${CODE_PREFIX}-%`}) AS territories,
      (SELECT count(*)::text FROM public.user_territory_assignments uta
        JOIN public.territories t ON t.id = uta.territory_id
        WHERE t.code LIKE ${`${CODE_PREFIX}-%`}) AS utas,
      (SELECT count(*)::text FROM public.facility_vertical_profiles
        WHERE territory_id IS NOT NULL) AS profiles_with_territory
  `);

  const row = Array.isArray(summary) ? summary[0] : (summary as { rows?: unknown[] }).rows?.[0];
  console.log("\n✅ Done");
  console.log(`   Manager login: ${manager.email} / ${managerPassword}`);
  console.log(`   Demo territories: ${(row as { territories?: string })?.territories ?? "?"}`);
  console.log(`   UTAs on demo territories: ${(row as { utas?: string })?.utas ?? "?"}`);
  console.log(
    `   Profiles with territory_id: ${(row as { profiles_with_territory?: string })?.profiles_with_territory ?? "?"}`,
  );
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
