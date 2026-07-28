/**
 * Local seed: Dermatologia zone/patch + user assigns + sample profiles/consultants.
 *
 * Clones geometry from an existing Ortopedia manager zone when present.
 * Creates a demo Derm REP and profiles/assigns for a sample of Ortopedia clinics.
 *
 *   bun run db:seed:dermatologia
 *
 * Env:
 *   SEED_MANAGER_EMAIL (default manager@atlasmed.com.br)
 *   SEED_DERM_REP_EMAIL (default derm.rep@atlasmed.com.br)
 *   SEED_DERM_REP_PASSWORD (default DermRep123!)
 *   SEED_DERM_PROFILE_LIMIT (default 40)
 */
import "dotenv/config";
import { hash } from "argon2";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
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
import type { GeoJsonGeometry } from "../modules/territory/application/interfaces/territory-spatial.repository.interface";

const CODE_PREFIX = "DEMO-DERM";

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
      `seed refused: host "${host}" is not local. Do not run Derm demo seed against shared/prod DBs.`,
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
  if (!row) throw new Error(`Business vertical "${code}" missing — run db:migrate`);
  return row.id;
}

async function ensureUserVertical(userId: string, verticalId: string): Promise<void> {
  const [existing] = await db
    .select({ id: userVerticalAssignments.id })
    .from(userVerticalAssignments)
    .where(
      and(
        eq(userVerticalAssignments.userId, userId),
        eq(userVerticalAssignments.verticalId, verticalId),
      ),
    )
    .limit(1);
  if (!existing) {
    await db.insert(userVerticalAssignments).values({ userId, verticalId });
  }
}

async function ensureManager(params: {
  email: string;
  dermVerticalId: string;
}): Promise<{ id: string; email: string }> {
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
  if (!existing) {
    throw new Error(
      `Manager ${params.email} missing — run bun run db:seed:sp-territories first (or create the user)`,
    );
  }

  await db
    .update(users)
    .set({ roleId: role.id, status: "ACTIVE", emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, existing.id));
  await ensureUserVertical(existing.id, params.dermVerticalId);
  return existing;
}

async function ensureDermRep(params: {
  email: string;
  password: string;
  dermVerticalId: string;
  managerId: string;
}): Promise<{ id: string; email: string; created: boolean }> {
  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, "REP"))
    .limit(1);
  if (!role) throw new Error("REP role missing");

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
        managerId: params.managerId,
        status: "ACTIVE",
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    await ensureUserVertical(existing.id, params.dermVerticalId);
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
      firstName: "Rep",
      lastName: "Dermatologia",
      roleId: role.id,
      managerId: params.managerId,
      status: "ACTIVE",
      emailVerified: true,
    })
    .returning({ id: users.id, email: users.email });

  await ensureUserVertical(created!.id, params.dermVerticalId);
  return { id: created!.id, email: created!.email, created: true };
}

async function clearDermDemoTerritories(): Promise<void> {
  const legacy = await db
    .select({ id: territories.id })
    .from(territories)
    .where(sql`${territories.code} LIKE ${`${CODE_PREFIX}-%`}`);
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

async function loadSourceZoneGeoJson(ortopediaId: string): Promise<GeoJsonGeometry | null> {
  const rows = await db.execute<{ geojson: string }>(sql`
    SELECT ST_AsGeoJSON(ST_Multi(ST_CollectionExtract(ST_MakeValid(t.boundary), 3)))::text AS geojson
    FROM public.territories t
    JOIN public.territory_types tt ON tt.id = t.territory_type_id
    WHERE t.vertical_id = ${ortopediaId}
      AND tt.slug = 'manager_zone'
      AND t.boundary IS NOT NULL
      AND NOT ST_IsEmpty(t.boundary)
    ORDER BY t.boundary_area_sq_km DESC NULLS LAST
    LIMIT 1
  `);
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row?.geojson) return null;
  return JSON.parse(row.geojson) as GeoJsonGeometry;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  assertLocalDatabaseUrl(databaseUrl);

  console.log("🌱 Seeding Dermatologia territories + sample commercial book...");

  const managerZoneTypeId = await requireTypeId("manager_zone");
  const patchTypeId = await requireTypeId("patch");
  const ortopediaId = await requireVerticalId("ORTOPEDIA");
  const dermId = await requireVerticalId("DERMATOLOGIA");

  await clearDermDemoTerritories();

  const managerEmail = process.env.SEED_MANAGER_EMAIL || "manager@atlasmed.com.br";
  const manager = await ensureManager({ email: managerEmail, dermVerticalId: dermId });
  console.log(`   Manager ${manager.email} → DERMATOLOGIA vertical`);

  const repEmail = process.env.SEED_DERM_REP_EMAIL || "derm.rep@atlasmed.com.br";
  const repPassword = process.env.SEED_DERM_REP_PASSWORD || "DermRep123!";
  const rep = await ensureDermRep({
    email: repEmail,
    password: repPassword,
    dermVerticalId: dermId,
    managerId: manager.id,
  });
  console.log(`   ${rep.created ? "Created" : "Using"} Derm REP ${rep.email}`);

  const sourceGeo = await loadSourceZoneGeoJson(ortopediaId);
  if (!sourceGeo) {
    throw new Error(
      "No Ortopedia manager_zone with boundary — run bun run db:seed:sp-territories first",
    );
  }

  const zoneId = await upsertTerritory({
    code: `${CODE_PREFIX}-ZONE`,
    name: "Zona gerente — Dermatologia (demo)",
    slug: "demo-derm-manager-zone",
    verticalId: dermId,
    territoryTypeId: managerZoneTypeId,
  });

  const patchId = await upsertTerritory({
    code: `${CODE_PREFIX}-PATCH-01`,
    name: "Patch Dermatologia (demo compartilhado)",
    slug: "demo-derm-patch-01",
    verticalId: dermId,
    territoryTypeId: patchTypeId,
    managerTerritoryId: zoneId,
  });

  await territoryRepositories.spatial.saveBoundary(zoneId, sourceGeo, { repairInvalid: true });
  await territoryRepositories.spatial.updateBoundaryMetadata(zoneId);
  await territoryRepositories.spatial.saveBoundary(patchId, sourceGeo, { repairInvalid: true });
  await territoryRepositories.spatial.updateBoundaryMetadata(patchId);

  await assignUserToTerritory({
    userId: manager.id,
    territoryId: zoneId,
    assignedBy: manager.id,
  });
  await assignUserToTerritory({
    userId: rep.id,
    territoryId: patchId,
    assignedBy: manager.id,
  });
  console.log(`   Zone ${CODE_PREFIX}-ZONE + patch ${CODE_PREFIX}-PATCH-01`);

  const limit = Number(process.env.SEED_DERM_PROFILE_LIMIT || "40");
  const sample = await db.execute<{ facility_id: string }>(sql`
    SELECT fvp.facility_id
    FROM public.facility_vertical_profiles fvp
    JOIN public.facilities f ON f.id = fvp.facility_id
    WHERE fvp.vertical_id = ${ortopediaId}
      AND fvp.is_active = true
      AND f.location IS NOT NULL
    ORDER BY f.updated_at DESC NULLS LAST
    LIMIT ${Number.isFinite(limit) ? limit : 40}
  `);
  const facilityIds = (Array.isArray(sample) ? sample : []).map((row) => row.facility_id);
  if (facilityIds.length === 0) {
    throw new Error("No Ortopedia facility profiles to sample for Dermatologia");
  }

  let profilesUpserted = 0;
  let assignsCreated = 0;
  for (const facilityId of facilityIds) {
    const [existingProfile] = await db
      .select({ id: facilityVerticalProfiles.id })
      .from(facilityVerticalProfiles)
      .where(
        and(
          eq(facilityVerticalProfiles.facilityId, facilityId),
          eq(facilityVerticalProfiles.verticalId, dermId),
        ),
      )
      .limit(1);

    if (existingProfile) {
      await db
        .update(facilityVerticalProfiles)
        .set({
          isActive: true,
          territoryId: patchId,
          updatedAt: new Date(),
        })
        .where(eq(facilityVerticalProfiles.id, existingProfile.id));
    } else {
      await db.insert(facilityVerticalProfiles).values({
        facilityId,
        verticalId: dermId,
        territoryId: patchId,
        isActive: true,
        commercialStatus: "UNREGISTERED",
      });
    }
    profilesUpserted += 1;

    const [activeAssign] = await db
      .select({ id: facilityConsultantAssignments.id, userId: facilityConsultantAssignments.userId })
      .from(facilityConsultantAssignments)
      .where(
        and(
          eq(facilityConsultantAssignments.facilityId, facilityId),
          eq(facilityConsultantAssignments.verticalId, dermId),
          isNull(facilityConsultantAssignments.endedAt),
        ),
      )
      .limit(1);

    if (!activeAssign) {
      await db.insert(facilityConsultantAssignments).values({
        facilityId,
        userId: rep.id,
        verticalId: dermId,
        assignedByUserId: manager.id,
      });
      assignsCreated += 1;
    } else if (activeAssign.userId !== rep.id) {
      await db
        .update(facilityConsultantAssignments)
        .set({
          endedAt: new Date(),
          endReason: "DEMO_DERM_REASSIGN",
          updatedAt: new Date(),
        })
        .where(eq(facilityConsultantAssignments.id, activeAssign.id));
      await db.insert(facilityConsultantAssignments).values({
        facilityId,
        userId: rep.id,
        verticalId: dermId,
        assignedByUserId: manager.id,
      });
      assignsCreated += 1;
    }
  }

  const { processed } = await territoryMembershipService.recomputeForTerritoryBoundary(patchId);

  console.log("\n✅ Dermatologia demo ready");
  console.log(`   Manager: ${manager.email} (zone UTA + vertical)`);
  console.log(`   REP: ${rep.email} / ${repPassword} (patch UTA + vertical)`);
  console.log(`   Profiles: ${profilesUpserted} | new consultant assigns: ${assignsCreated}`);
  console.log(`   Membership recompute: ${processed} clinics in patch bbox`);
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
