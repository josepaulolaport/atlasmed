import "dotenv/config";
import { hash } from "argon2";
import { db } from "../infrastructure/database/db";
import {
  roles,
  users,
  territories,
  territoryClosure,
  userTerritoryAssignments,
  facilities,
  professionals,
  facilityProfessionals,
  cnesRuns,
  cnesSuggestions,
} from "@atlasmed/database";
import { eq, and, or, inArray, like, sql } from "drizzle-orm";
import { ROLE_PRIORITY_BY_NAME } from "../modules/access/application/constants/role-priority.constants";
import { TerritoryClosureService } from "../modules/territory/application/services/territory-closure.service";
import { DrizzleTerritoryRepository } from "../modules/territory/infrastructure/repositories/drizzle/drizzle-territory.repository";
import { DrizzleTerritoryClosureRepository } from "../modules/territory/infrastructure/repositories/drizzle/drizzle-territory-closure.repository";

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || "Password123!";
const DEMO_DOMAIN = "demo.atlasmed.local";
const DEMO_TAG = "[Demo]";

const closureService = new TerritoryClosureService({
  territoryRepository: new DrizzleTerritoryRepository(),
  closureRepository: new DrizzleTerritoryClosureRepository(),
});

async function rebuildClosure(territoryId: string): Promise<void> {
  await closureService.rebuildSubtree(territoryId);
}

function parseArgs(argv: string[]) {
  return {
    clean: argv.includes("--clean"),
    skipClean: argv.includes("--skip-clean"),
  };
}

async function ensureRoles() {
  const roleDefs = [
    {
      name: "ADMIN",
      description: "Full system access",
      priority: ROLE_PRIORITY_BY_NAME.ADMIN,
    },
    {
      name: "MANAGER",
      description: "Territory manager",
      priority: ROLE_PRIORITY_BY_NAME.MANAGER,
    },
    {
      name: "OPS",
      description: "Operations (read-only)",
      priority: ROLE_PRIORITY_BY_NAME.OPS,
    },
    {
      name: "REP",
      description: "Field representative",
      priority: ROLE_PRIORITY_BY_NAME.REP,
    },
  ];

  for (const role of roleDefs) {
    await db
      .insert(roles)
      .values(role)
      .onConflictDoUpdate({
        target: roles.name,
        set: { description: role.description, priority: role.priority, updatedAt: new Date() },
      });
  }

  const findRole = async (name: string) => {
    const role = await db.query.roles.findFirst({ where: eq(roles.name, name) });
    if (!role) throw new Error(`Role "${name}" not found after upsert`);
    return role;
  };

  return {
    admin: await findRole("ADMIN"),
    manager: await findRole("MANAGER"),
    ops: await findRole("OPS"),
    rep: await findRole("REP"),
  };
}

async function cleanupDemoData() {
  console.log("🧹 Removing previous demo data...");

  const demoUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `%@${DEMO_DOMAIN}`));
  const demoUserIds = demoUsers.map((u) => u.id);

  const demoFacilities = await db
    .select({ id: facilities.id })
    .from(facilities)
    .where(like(facilities.displayName, `%${DEMO_TAG}%`));
  const demoFacilityIds = demoFacilities.map((f) => f.id);

  const demoProfessionals = await db
    .select({ id: professionals.id })
    .from(professionals)
    .where(like(professionals.lastName, `%${DEMO_TAG}%`));
  const demoProfessionalIds = demoProfessionals.map((p) => p.id);

  if (demoFacilityIds.length > 0 || demoProfessionalIds.length > 0) {
    const suggestionConditions = [
      ...(demoFacilityIds.length > 0 ? [inArray(cnesSuggestions.facilityId, demoFacilityIds)] : []),
      ...(demoProfessionalIds.length > 0 ? [inArray(cnesSuggestions.professionalId, demoProfessionalIds)] : []),
    ];
    await db.delete(cnesSuggestions).where(or(...suggestionConditions));

    const fpConditions = [
      ...(demoFacilityIds.length > 0 ? [inArray(facilityProfessionals.facilityId, demoFacilityIds)] : []),
      ...(demoProfessionalIds.length > 0 ? [inArray(facilityProfessionals.professionalId, demoProfessionalIds)] : []),
    ];
    await db.delete(facilityProfessionals).where(or(...fpConditions));
  }

  if (demoProfessionalIds.length > 0) {
    await db.delete(professionals).where(inArray(professionals.id, demoProfessionalIds));
  }

  if (demoFacilityIds.length > 0) {
    await db.delete(facilities).where(inArray(facilities.id, demoFacilityIds));
  }

  if (demoUserIds.length > 0) {
    const { sessions } = await import("@atlasmed/database");
    await db.delete(sessions).where(inArray(sessions.userId, demoUserIds));
    await db.delete(userTerritoryAssignments).where(inArray(userTerritoryAssignments.userId, demoUserIds));
    await db.delete(users).where(inArray(users.id, demoUserIds));
  }

  const demoTerritories = await db
    .select({ id: territories.id })
    .from(territories)
    .where(like(territories.code, "DEMO-%"));
  const demoTerritoryIds = demoTerritories.map((t) => t.id);

  if (demoTerritoryIds.length > 0) {
    await db.delete(territoryClosure).where(
      or(
        inArray(territoryClosure.ancestorId, demoTerritoryIds),
        inArray(territoryClosure.descendantId, demoTerritoryIds)
      )
    );
    await db.delete(territories).where(inArray(territories.id, demoTerritoryIds));
  }

  await db.delete(cnesRuns).where(eq(cnesRuns.sourceProvider, "demo_seed"));

  console.log("   ✓ Demo data removed");
}

async function seedTerritories() {
  let country = await db.query.territories.findFirst({
    where: and(
      eq(territories.territoryTypeId, "tt_country"),
      eq(territories.countryCode, "BR"),
      eq(territories.isActive, true)
    ),
  });

  if (!country) {
    [country] = await db
      .insert(territories)
      .values({
        name: `Brazil ${DEMO_TAG}`,
        slug: "demo-br",
        code: "DEMO-BR",
        nodeType: "region",
        territoryTypeId: "tt_country",
        countryCode: "BR",
        regionSlug: "BR",
      })
      .returning();
    await rebuildClosure(country!.id);
  }

  const [region] = await db
    .insert(territories)
    .values({
      name: `Southeast ${DEMO_TAG}`,
      slug: "demo-se",
      code: "DEMO-BR-SE",
      nodeType: "region",
      territoryTypeId: "tt_region",
      countryCode: "BR",
      regionSlug: "SE",
      parentId: country!.id,
    })
    .returning();
  await rebuildClosure(region!.id);

  const [inScopePatch] = await db
    .insert(territories)
    .values({
      name: `São Paulo Patch ${DEMO_TAG}`,
      slug: "demo-sp-patch",
      code: "DEMO-BR-SE-SP",
      nodeType: "patch",
      territoryTypeId: "tt_patch",
      countryCode: "BR",
      regionSlug: "SE",
      parentId: region!.id,
    })
    .returning();
  await rebuildClosure(inScopePatch!.id);

  const [northRegion] = await db
    .insert(territories)
    .values({
      name: `North ${DEMO_TAG}`,
      slug: "demo-n",
      code: "DEMO-BR-N",
      nodeType: "region",
      territoryTypeId: "tt_region",
      countryCode: "BR",
      regionSlug: "N",
      parentId: country!.id,
    })
    .returning();
  await rebuildClosure(northRegion!.id);

  const [outOfScopePatch] = await db
    .insert(territories)
    .values({
      name: `Manaus Patch ${DEMO_TAG}`,
      slug: "demo-am-patch",
      code: "DEMO-BR-N-AM",
      nodeType: "patch",
      territoryTypeId: "tt_patch",
      countryCode: "BR",
      regionSlug: "N",
      parentId: northRegion!.id,
    })
    .returning();
  await rebuildClosure(outOfScopePatch!.id);

  return { inScopePatchId: inScopePatch!.id, outOfScopePatchId: outOfScopePatch!.id };
}

async function seedUsers(roleSet: {
  admin: { id: string };
  manager: { id: string };
  rep: { id: string };
}) {
  const passwordHash = await hash(DEMO_PASSWORD);

  const [admin] = await db
    .insert(users)
    .values({
      email: `admin@${DEMO_DOMAIN}`,
      username: "demo_admin",
      passwordHash,
      firstName: "Demo",
      lastName: "Admin",
      roleId: roleSet.admin.id,
      status: "ACTIVE",
      emailVerified: true,
    })
    .returning();

  const [manager] = await db
    .insert(users)
    .values({
      email: `manager@${DEMO_DOMAIN}`,
      username: "demo_manager",
      passwordHash,
      firstName: "Demo",
      lastName: "Manager",
      roleId: roleSet.manager.id,
      status: "ACTIVE",
      emailVerified: true,
    })
    .returning();

  const [fieldUser] = await db
    .insert(users)
    .values({
      email: `field@${DEMO_DOMAIN}`,
      username: "demo_field",
      passwordHash,
      firstName: "Demo",
      lastName: "Field Rep",
      roleId: roleSet.rep.id,
      status: "ACTIVE",
      emailVerified: true,
      managerId: manager!.id,
    })
    .returning();

  return { admin: admin!, manager: manager!, fieldUser: fieldUser! };
}

async function seedFacilities(territorySet: {
  inScopePatchId: string;
  outOfScopePatchId: string;
}) {
  const [clinicAlpha] = await db
    .insert(facilities)
    .values({
      displayName: `Clínica Alpha ${DEMO_TAG}`,
      address: "Av. Paulista, 1000, São Paulo, SP",
      location: sql`ST_SetSRID(ST_MakePoint(${-46.6559}, ${-23.5614}), 4326)`,
      territoryId: territorySet.inScopePatchId,
      territoryAssignmentStatus: "assigned",
      phoneNumber: "1133334444",
      email: `alpha@${DEMO_DOMAIN}`,
    })
    .returning();

  const [clinicBeta] = await db
    .insert(facilities)
    .values({
      displayName: `Clínica Beta ${DEMO_TAG}`,
      address: "Rua Oscar Freire, 200, São Paulo, SP",
      location: sql`ST_SetSRID(ST_MakePoint(${-46.6734}, ${-23.5671}), 4326)`,
      territoryId: territorySet.inScopePatchId,
      territoryAssignmentStatus: "assigned",
      phoneNumber: "1144445555",
    })
    .returning();

  const [clinicGamma] = await db
    .insert(facilities)
    .values({
      displayName: `Clínica Gamma ${DEMO_TAG}`,
      address: "Rua Augusta, 500, São Paulo, SP",
      location: sql`ST_SetSRID(ST_MakePoint(${-46.6333}, ${-23.5505}), 4326)`,
      territoryId: territorySet.inScopePatchId,
      territoryAssignmentStatus: "assigned",
    })
    .returning();

  const [clinicNorth] = await db
    .insert(facilities)
    .values({
      displayName: `Clínica Norte ${DEMO_TAG}`,
      address: "Av. Eduardo Ribeiro, 100, Manaus, AM",
      location: sql`ST_SetSRID(ST_MakePoint(${-60.0217}, ${-3.119}), 4326)`,
      territoryId: territorySet.outOfScopePatchId,
      territoryAssignmentStatus: "assigned",
    })
    .returning();

  return {
    clinicAlpha: clinicAlpha!,
    clinicBeta: clinicBeta!,
    clinicGamma: clinicGamma!,
    clinicNorth: clinicNorth!,
  };
}

async function seedProfessionals() {
  const [ana] = await db
    .insert(professionals)
    .values({
      firstName: "Ana",
      lastName: `Paula Silva ${DEMO_TAG}`,
      fullName: "Ana Paula Silva",
      socialName: "Ana",
      taxId: "52998224725",
      birthDate: new Date("1985-03-15"),
      mobilePhone: "11999887766",
      landlinePhone: "1133221100",
      email: `ana.silva@${DEMO_DOMAIN}`,
      websiteUrl: "https://example.com/ana-silva",
      imageUrl: "https://i.pravatar.cc/300?u=ana-demo",
      primarySpecialtyLabel: "Cardiology",
      crmCouncil: "CRM",
      crmNumber: "123456",
      crmState: "SP",
      favoriteTeam: "Corinthians",
      favoriteSport: "Tennis",
      hobbies: "Reading, travel",
      notes: "Key opinion leader in cardiology.",
    })
    .returning();

  const [carlos] = await db
    .insert(professionals)
    .values({
      firstName: "Carlos",
      lastName: `Eduardo Mendes ${DEMO_TAG}`,
      fullName: "Carlos Eduardo Mendes",
      taxId: "39053344705",
      birthDate: new Date("1978-11-02"),
      mobilePhone: "11988776655",
      email: `carlos.mendes@${DEMO_DOMAIN}`,
      primarySpecialtyLabel: "Orthopedics",
      crmCouncil: "CRM",
      crmNumber: "654321",
      crmState: "SP",
      favoriteTeam: "Palmeiras",
      notes: "Pending confirmation at Alpha clinic.",
    })
    .returning();

  const [beatriz] = await db
    .insert(professionals)
    .values({
      firstName: "Beatriz",
      lastName: `Oliveira ${DEMO_TAG}`,
      fullName: "Beatriz Oliveira",
      taxId: "11144477735",
      birthDate: new Date("1990-07-20"),
      mobilePhone: "11977665544",
      email: `beatriz.oliveira@${DEMO_DOMAIN}`,
      primarySpecialtyLabel: "Dermatology",
      crmCouncil: "CRM",
      crmNumber: "789012",
      crmState: "SP",
    })
    .returning();

  const [diego] = await db
    .insert(professionals)
    .values({
      firstName: "Diego",
      lastName: `Ferreira ${DEMO_TAG}`,
      fullName: "Diego Ferreira",
      taxId: "23100299900",
      mobilePhone: "92988776655",
      email: `diego.ferreira@${DEMO_DOMAIN}`,
      primarySpecialtyLabel: "General Practice",
      crmCouncil: "CRM",
      crmNumber: "345678",
      crmState: "AM",
      notes: "Based in Manaus — out-of-scope for SP field rep.",
    })
    .returning();

  const [registryOnly] = await db
    .insert(professionals)
    .values({
      firstName: "Fernanda",
      lastName: `Lima ${DEMO_TAG}`,
      fullName: "Fernanda Lima",
      taxId: "40364478835",
      primarySpecialtyLabel: "Pediatrics",
      sourceProvider: "demo_seed",
      externalSourceId: "demo-prof-fernanda",
      sourcePresent: true,
      sourceTracked: true,
      sourceFirstSeenAt: new Date(),
      sourceLastSeenAt: new Date(),
    })
    .returning();

  return {
    ana: ana!,
    carlos: carlos!,
    beatriz: beatriz!,
    diego: diego!,
    registryOnly: registryOnly!,
  };
}

async function seedAssociations(params: {
  facilities: Awaited<ReturnType<typeof seedFacilities>>;
  professionals: Awaited<ReturnType<typeof seedProfessionals>>;
  adminUserId: string;
}) {
  const { facilities: facs, professionals: profs, adminUserId } = params;
  const now = new Date();

  const [anaAlpha] = await db
    .insert(facilityProfessionals)
    .values({
      facilityId: facs.clinicAlpha.id,
      professionalId: profs.ana.id,
      specialtyLabel: "Interventional cardiology",
      isPartner: true,
      isPrescriber: true,
      isBuyer: false,
      isDecisionMaker: true,
      relationshipLevel: "HIGH",
      notes: "Primary contact at Alpha — partner and decision maker.",
      confirmedAt: now,
      confirmedByUserId: adminUserId,
    })
    .returning();

  await db.insert(facilityProfessionals).values({
    facilityId: facs.clinicBeta.id,
    professionalId: profs.ana.id,
    isPartner: false,
    isPrescriber: true,
    isBuyer: true,
    isDecisionMaker: false,
    relationshipLevel: "MEDIUM",
    confirmedAt: now,
    confirmedByUserId: adminUserId,
  });

  const [carlosPending] = await db
    .insert(facilityProfessionals)
    .values({
      facilityId: facs.clinicAlpha.id,
      professionalId: profs.carlos.id,
      sourceActive: true,
      sourceFirstSeenAt: now,
      sourceLastSeenAt: now,
      isPrescriber: true,
      relationshipLevel: "LOW",
      notes: "Awaiting manager confirmation.",
    })
    .returning();

  await db.insert(facilityProfessionals).values({
    facilityId: facs.clinicGamma.id,
    professionalId: profs.beatriz.id,
    confirmedAt: now,
    confirmedByUserId: adminUserId,
    isDecisionMaker: true,
    relationshipLevel: "MEDIUM",
  });

  await db.insert(facilityProfessionals).values({
    facilityId: facs.clinicNorth.id,
    professionalId: profs.diego.id,
    confirmedAt: now,
    confirmedByUserId: adminUserId,
    isPartner: true,
    relationshipLevel: "HIGH",
  });

  const [fernandaSource] = await db
    .insert(facilityProfessionals)
    .values({
      facilityId: facs.clinicBeta.id,
      professionalId: profs.registryOnly.id,
      sourceActive: true,
      sourceFirstSeenAt: now,
      sourceLastSeenAt: now,
      specialtyLabel: "Pediatrics",
    })
    .returning();

  return { anaAlpha: anaAlpha!, carlosPending: carlosPending!, fernandaSource: fernandaSource! };
}

async function seedRegistrySuggestions(params: {
  facilities: Awaited<ReturnType<typeof seedFacilities>>;
  associations: Awaited<ReturnType<typeof seedAssociations>>;
}) {
  const [run] = await db
    .insert(cnesRuns)
    .values({
      sourceProvider: "demo_seed",
      status: "COMPLETED",
      completedAt: new Date(),
      stats: { facilitiesCreated: 0, professionalsCreated: 1, suggestionsCreated: 2 },
    })
    .returning();

  await db.insert(cnesSuggestions).values({
    ingestionRunId: run!.id,
    type: "FACILITY_PROFESSIONAL_REMOVAL",
    status: "PENDING",
    facilityId: params.facilities.clinicAlpha.id,
    professionalId: params.associations.carlosPending.professionalId,
    facilityProfessionalId: params.associations.carlosPending.id,
    reason: "missing_from_source",
    payload: { demo: true, message: "Registry no longer lists this association" },
  });

  await db.insert(cnesSuggestions).values({
    ingestionRunId: run!.id,
    type: "FACILITY_FIELD_UPDATE",
    status: "PENDING",
    facilityId: params.facilities.clinicBeta.id,
    reason: "field_mismatch",
    payload: {
      demo: true,
      field: "phoneNumber",
      current: "1144445555",
      suggested: "1155556666",
    },
  });

  return run!;
}

function printSummary(params: {
  territories: { inScopePatchId: string; outOfScopePatchId: string };
  facilities: Awaited<ReturnType<typeof seedFacilities>>;
  professionals: Awaited<ReturnType<typeof seedProfessionals>>;
  fieldUserId: string;
}) {
  const { territories: terrs, facilities: facs, professionals: profs, fieldUserId } = params;

  console.log("\n✅ Demo seed completed!\n");
  console.log("── Login credentials (password for all: %s) ──", DEMO_PASSWORD);
  console.log("  ADMIN   admin@%s", DEMO_DOMAIN);
  console.log("  MANAGER manager@%s", DEMO_DOMAIN);
  console.log("  USER    field@%s  (assigned to São Paulo patch)", DEMO_DOMAIN);
  console.log("\n── Web routes to try ──");
  console.log("  /professionals");
  console.log("  /professionals/%s  (Ana — full CRM profile)", profs.ana.id);
  console.log(
    "  /facilities/%s/professionals/%s  (registration form)",
    facs.clinicAlpha.id,
    profs.ana.id
  );
  console.log("  /facilities/%s  (roster: pending + confirmed)", facs.clinicAlpha.id);
  console.log("  /facilities/%s  (out-of-scope for field user)", facs.clinicNorth.id);
  console.log("  /registry-suggestions  (2 pending suggestions)");
  console.log("\n── Scope notes ──");
  console.log("  Field user id: %s", fieldUserId);
  console.log("  In-scope territory: %s", terrs.inScopePatchId);
  console.log("  Out-of-scope territory: %s", terrs.outOfScopePatchId);
  console.log("  Diego + Clínica Norte are out-of-scope for field@%s", DEMO_DOMAIN);
  console.log("");
}

async function seedDemoData() {
  const roleSet = await ensureRoles();
  const territorySet = await seedTerritories();
  const seededUsers = await seedUsers(roleSet);

  await db.insert(userTerritoryAssignments).values({
    userId: seededUsers.fieldUser.id,
    territoryId: territorySet.inScopePatchId,
    assignedBy: seededUsers.admin.id,
  });

  const facilitySet = await seedFacilities(territorySet);
  const professionalSet = await seedProfessionals();
  const associations = await seedAssociations({
    facilities: facilitySet,
    professionals: professionalSet,
    adminUserId: seededUsers.admin.id,
  });
  await seedRegistrySuggestions({ facilities: facilitySet, associations });

  printSummary({
    territories: territorySet,
    facilities: facilitySet,
    professionals: professionalSet,
    fieldUserId: seededUsers.fieldUser.id,
  });
}

async function main() {
  const { clean, skipClean } = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  console.log("\n🌱 AtlasMed demo data seed\n");
  console.log("   Database: %s", process.env.DATABASE_URL.replace(/:[^:@]+@/, ":***@"));

  if (clean || !skipClean) {
    await cleanupDemoData();
  }

  await seedDemoData();
}

main()
  .catch((error) => {
    console.error("\n❌ Demo seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$client.end();
  });
