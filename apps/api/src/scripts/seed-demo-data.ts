import "dotenv/config";
import { hash } from "argon2";
import { prisma } from "../infrastructure/database/prisma.client";
import { ROLE_PRIORITY_BY_NAME } from "../modules/access/application/constants/role-priority.constants";
import { TerritoryClosureService } from "../modules/territory/application/services/territory-closure.service";
import { PrismaTerritoryRepository } from "../modules/territory/infrastructure/repositories/prisma/prisma-territory.repository";
import { PrismaTerritoryClosureRepository } from "../modules/territory/infrastructure/repositories/prisma/prisma-territory-closure.repository";

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || "Password123!";
const DEMO_DOMAIN = "demo.atlasmed.local";
const DEMO_TAG = "[Demo]";

const closureService = new TerritoryClosureService({
  territoryRepository: new PrismaTerritoryRepository(),
  closureRepository: new PrismaTerritoryClosureRepository(),
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
  const roles = [
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

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, priority: role.priority },
      create: role,
    });
  }

  return {
    admin: await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } }),
    manager: await prisma.role.findUniqueOrThrow({ where: { name: "MANAGER" } }),
    ops: await prisma.role.findUniqueOrThrow({ where: { name: "OPS" } }),
    rep: await prisma.role.findUniqueOrThrow({ where: { name: "REP" } }),
  };
}

async function cleanupDemoData() {
  console.log("🧹 Removing previous demo data...");

  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: `@${DEMO_DOMAIN}` } },
    select: { id: true },
  });
  const demoUserIds = demoUsers.map((user) => user.id);

  const demoFacilities = await prisma.facility.findMany({
    where: { displayName: { contains: DEMO_TAG } },
    select: { id: true },
  });
  const demoFacilityIds = demoFacilities.map((facility) => facility.id);

  const demoProfessionals = await prisma.professional.findMany({
    where: { lastName: { contains: DEMO_TAG } },
    select: { id: true },
  });
  const demoProfessionalIds = demoProfessionals.map((professional) => professional.id);

  if (demoFacilityIds.length > 0 || demoProfessionalIds.length > 0) {
    await prisma.ingestionSuggestion.deleteMany({
      where: {
        OR: [
          ...(demoFacilityIds.length > 0 ? [{ facilityId: { in: demoFacilityIds } }] : []),
          ...(demoProfessionalIds.length > 0
            ? [{ professionalId: { in: demoProfessionalIds } }]
            : []),
        ],
      },
    });
  }

  await prisma.facilityProfessional.deleteMany({
    where: {
      OR: [
        ...(demoFacilityIds.length > 0 ? [{ facilityId: { in: demoFacilityIds } }] : []),
        ...(demoProfessionalIds.length > 0
          ? [{ professionalId: { in: demoProfessionalIds } }]
          : []),
      ],
    },
  });

  if (demoProfessionalIds.length > 0) {
    await prisma.professional.deleteMany({ where: { id: { in: demoProfessionalIds } } });
  }

  if (demoFacilityIds.length > 0) {
    await prisma.facility.deleteMany({ where: { id: { in: demoFacilityIds } } });
  }

  if (demoUserIds.length > 0) {
    await prisma.session.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.userTerritoryAssignment.deleteMany({
      where: { userId: { in: demoUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } });
  }

  const demoTerritories = await prisma.territory.findMany({
    where: { code: { startsWith: "DEMO-" } },
    select: { id: true },
  });
  const demoTerritoryIds = demoTerritories.map((territory) => territory.id);

  if (demoTerritoryIds.length > 0) {
    await prisma.territoryClosure.deleteMany({
      where: {
        OR: [
          { ancestorId: { in: demoTerritoryIds } },
          { descendantId: { in: demoTerritoryIds } },
        ],
      },
    });
    await prisma.territory.deleteMany({ where: { id: { in: demoTerritoryIds } } });
  }

  await prisma.ingestionRun.deleteMany({
    where: { sourceProvider: "demo_seed" },
  });

  console.log("   ✓ Demo data removed");
}

async function seedTerritories() {
  let country = await prisma.territory.findFirst({
    where: { territoryTypeId: "tt_country", countryCode: "BR", isActive: true },
  });

  if (!country) {
    country = await prisma.territory.create({
      data: {
        name: `Brazil ${DEMO_TAG}`,
        slug: "demo-br",
        code: "DEMO-BR",
        nodeType: "region",
        territoryTypeId: "tt_country",
        countryCode: "BR",
        regionSlug: "BR",
      },
    });
    await rebuildClosure(country.id);
  }

  const region = await prisma.territory.create({
    data: {
      name: `Southeast ${DEMO_TAG}`,
      slug: "demo-se",
      code: "DEMO-BR-SE",
      nodeType: "region",
      territoryTypeId: "tt_region",
      countryCode: "BR",
      regionSlug: "SE",
      parentId: country.id,
    },
  });
  await rebuildClosure(region.id);

  const inScopePatch = await prisma.territory.create({
    data: {
      name: `São Paulo Patch ${DEMO_TAG}`,
      slug: "demo-sp-patch",
      code: "DEMO-BR-SE-SP",
      nodeType: "patch",
      territoryTypeId: "tt_patch",
      countryCode: "BR",
      regionSlug: "SE",
      parentId: region.id,
    },
  });
  await rebuildClosure(inScopePatch.id);

  const northRegion = await prisma.territory.create({
    data: {
      name: `North ${DEMO_TAG}`,
      slug: "demo-n",
      code: "DEMO-BR-N",
      nodeType: "region",
      territoryTypeId: "tt_region",
      countryCode: "BR",
      regionSlug: "N",
      parentId: country.id,
    },
  });
  await rebuildClosure(northRegion.id);

  const outOfScopePatch = await prisma.territory.create({
    data: {
      name: `Manaus Patch ${DEMO_TAG}`,
      slug: "demo-am-patch",
      code: "DEMO-BR-N-AM",
      nodeType: "patch",
      territoryTypeId: "tt_patch",
      countryCode: "BR",
      regionSlug: "N",
      parentId: northRegion.id,
    },
  });
  await rebuildClosure(outOfScopePatch.id);

  return { inScopePatchId: inScopePatch.id, outOfScopePatchId: outOfScopePatch.id };
}

async function seedUsers(roles: {
  admin: { id: string };
  manager: { id: string };
  user: { id: string };
}) {
  const passwordHash = await hash(DEMO_PASSWORD);

  const admin = await prisma.user.create({
    data: {
      email: `admin@${DEMO_DOMAIN}`,
      username: "demo_admin",
      passwordHash,
      firstName: "Demo",
      lastName: "Admin",
      roleId: roles.admin.id,
      status: "ACTIVE",
      emailVerified: true,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: `manager@${DEMO_DOMAIN}`,
      username: "demo_manager",
      passwordHash,
      firstName: "Demo",
      lastName: "Manager",
      roleId: roles.manager.id,
      status: "ACTIVE",
      emailVerified: true,
    },
  });

  const fieldUser = await prisma.user.create({
    data: {
      email: `field@${DEMO_DOMAIN}`,
      username: "demo_field",
      passwordHash,
      firstName: "Demo",
      lastName: "Field Rep",
      roleId: roles.rep.id,
      status: "ACTIVE",
      emailVerified: true,
      managerId: manager.id,
    },
  });

  return { admin, manager, fieldUser };
}

async function seedFacilities(territories: {
  inScopePatchId: string;
  outOfScopePatchId: string;
}) {
  const clinicAlpha = await prisma.facility.create({
    data: {
      displayName: `Clínica Alpha ${DEMO_TAG}`,
      address: "Av. Paulista, 1000, São Paulo, SP",
      lat: -23.5614,
      lng: -46.6559,
      territoryId: territories.inScopePatchId,
      territoryAssignmentStatus: "assigned",
      phoneNumber: "1133334444",
      email: `alpha@${DEMO_DOMAIN}`,
    },
  });

  const clinicBeta = await prisma.facility.create({
    data: {
      displayName: `Clínica Beta ${DEMO_TAG}`,
      address: "Rua Oscar Freire, 200, São Paulo, SP",
      lat: -23.5671,
      lng: -46.6734,
      territoryId: territories.inScopePatchId,
      territoryAssignmentStatus: "assigned",
      phoneNumber: "1144445555",
    },
  });

  const clinicGamma = await prisma.facility.create({
    data: {
      displayName: `Clínica Gamma ${DEMO_TAG}`,
      address: "Rua Augusta, 500, São Paulo, SP",
      lat: -23.5505,
      lng: -46.6333,
      territoryId: territories.inScopePatchId,
      territoryAssignmentStatus: "assigned",
    },
  });

  const clinicNorth = await prisma.facility.create({
    data: {
      displayName: `Clínica Norte ${DEMO_TAG}`,
      address: "Av. Eduardo Ribeiro, 100, Manaus, AM",
      lat: -3.119,
      lng: -60.0217,
      territoryId: territories.outOfScopePatchId,
      territoryAssignmentStatus: "assigned",
    },
  });

  return { clinicAlpha, clinicBeta, clinicGamma, clinicNorth };
}

async function seedProfessionals() {
  const ana = await prisma.professional.create({
    data: {
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
    },
  });

  const carlos = await prisma.professional.create({
    data: {
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
    },
  });

  const beatriz = await prisma.professional.create({
    data: {
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
    },
  });

  const diego = await prisma.professional.create({
    data: {
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
    },
  });

  const registryOnly = await prisma.professional.create({
    data: {
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
    },
  });

  return { ana, carlos, beatriz, diego, registryOnly };
}

async function seedAssociations(params: {
  facilities: Awaited<ReturnType<typeof seedFacilities>>;
  professionals: Awaited<ReturnType<typeof seedProfessionals>>;
  adminUserId: string;
}) {
  const { facilities, professionals, adminUserId } = params;
  const now = new Date();

  const anaAlpha = await prisma.facilityProfessional.create({
    data: {
      facilityId: facilities.clinicAlpha.id,
      professionalId: professionals.ana.id,
      specialtyLabel: "Interventional cardiology",
      isPartner: true,
      isPrescriber: true,
      isBuyer: false,
      isDecisionMaker: true,
      relationshipLevel: "HIGH",
      notes: "Primary contact at Alpha — partner and decision maker.",
      confirmedAt: now,
      confirmedByUserId: adminUserId,
    },
  });

  await prisma.facilityProfessional.create({
    data: {
      facilityId: facilities.clinicBeta.id,
      professionalId: professionals.ana.id,
      isPartner: false,
      isPrescriber: true,
      isBuyer: true,
      isDecisionMaker: false,
      relationshipLevel: "MEDIUM",
      confirmedAt: now,
      confirmedByUserId: adminUserId,
    },
  });

  const carlosPending = await prisma.facilityProfessional.create({
    data: {
      facilityId: facilities.clinicAlpha.id,
      professionalId: professionals.carlos.id,
      sourceActive: true,
      sourceFirstSeenAt: now,
      sourceLastSeenAt: now,
      isPrescriber: true,
      relationshipLevel: "LOW",
      notes: "Awaiting manager confirmation.",
    },
  });

  await prisma.facilityProfessional.create({
    data: {
      facilityId: facilities.clinicGamma.id,
      professionalId: professionals.beatriz.id,
      confirmedAt: now,
      confirmedByUserId: adminUserId,
      isDecisionMaker: true,
      relationshipLevel: "MEDIUM",
    },
  });

  await prisma.facilityProfessional.create({
    data: {
      facilityId: facilities.clinicNorth.id,
      professionalId: professionals.diego.id,
      confirmedAt: now,
      confirmedByUserId: adminUserId,
      isPartner: true,
      relationshipLevel: "HIGH",
    },
  });

  const fernandaSource = await prisma.facilityProfessional.create({
    data: {
      facilityId: facilities.clinicBeta.id,
      professionalId: professionals.registryOnly.id,
      sourceActive: true,
      sourceFirstSeenAt: now,
      sourceLastSeenAt: now,
      specialtyLabel: "Pediatrics",
    },
  });

  return { anaAlpha, carlosPending, fernandaSource };
}

async function seedRegistrySuggestions(params: {
  facilities: Awaited<ReturnType<typeof seedFacilities>>;
  associations: Awaited<ReturnType<typeof seedAssociations>>;
}) {
  const run = await prisma.ingestionRun.create({
    data: {
      sourceProvider: "demo_seed",
      status: "COMPLETED",
      completedAt: new Date(),
      stats: { facilitiesCreated: 0, professionalsCreated: 1, suggestionsCreated: 2 },
    },
  });

  await prisma.ingestionSuggestion.create({
    data: {
      ingestionRunId: run.id,
      type: "FACILITY_PROFESSIONAL_REMOVAL",
      status: "PENDING",
      facilityId: params.facilities.clinicAlpha.id,
      professionalId: params.associations.carlosPending.professionalId,
      facilityProfessionalId: params.associations.carlosPending.id,
      reason: "missing_from_source",
      payload: { demo: true, message: "Registry no longer lists this association" },
    },
  });

  await prisma.ingestionSuggestion.create({
    data: {
      ingestionRunId: run.id,
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
    },
  });

  return run;
}

function printSummary(params: {
  territories: { inScopePatchId: string; outOfScopePatchId: string };
  facilities: Awaited<ReturnType<typeof seedFacilities>>;
  professionals: Awaited<ReturnType<typeof seedProfessionals>>;
  fieldUserId: string;
}) {
  const { territories, facilities, professionals, fieldUserId } = params;

  console.log("\n✅ Demo seed completed!\n");
  console.log("── Login credentials (password for all: %s) ──", DEMO_PASSWORD);
  console.log("  ADMIN   admin@%s", DEMO_DOMAIN);
  console.log("  MANAGER manager@%s", DEMO_DOMAIN);
  console.log("  USER    field@%s  (assigned to São Paulo patch)", DEMO_DOMAIN);
  console.log("\n── Web routes to try ──");
  console.log("  /professionals");
  console.log("  /professionals/%s  (Ana — full CRM profile)", professionals.ana.id);
  console.log(
    "  /facilities/%s/professionals/%s  (registration form)",
    facilities.clinicAlpha.id,
    professionals.ana.id
  );
  console.log("  /facilities/%s  (roster: pending + confirmed)", facilities.clinicAlpha.id);
  console.log("  /facilities/%s  (out-of-scope for field user)", facilities.clinicNorth.id);
  console.log("  /registry-suggestions  (2 pending suggestions)");
  console.log("\n── Scope notes ──");
  console.log("  Field user id: %s", fieldUserId);
  console.log("  In-scope territory: %s", territories.inScopePatchId);
  console.log("  Out-of-scope territory: %s", territories.outOfScopePatchId);
  console.log("  Diego + Clínica Norte are out-of-scope for field@%s", DEMO_DOMAIN);
  console.log("");
}

async function seedDemoData() {
  const roles = await ensureRoles();
  const territories = await seedTerritories();
  const users = await seedUsers(roles);

  await prisma.userTerritoryAssignment.create({
    data: {
      userId: users.fieldUser.id,
      territoryId: territories.inScopePatchId,
      assignedBy: users.admin.id,
    },
  });

  const facilities = await seedFacilities(territories);
  const professionals = await seedProfessionals();
  const associations = await seedAssociations({
    facilities,
    professionals,
    adminUserId: users.admin.id,
  });
  await seedRegistrySuggestions({ facilities, associations });

  printSummary({
    territories,
    facilities,
    professionals,
    fieldUserId: users.fieldUser.id,
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
    await prisma.$disconnect();
  });
