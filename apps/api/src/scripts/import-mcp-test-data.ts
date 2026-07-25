import "dotenv/config";
import { db } from "../infrastructure/database/db";
import { users, roles } from "@atlasmed/database";
import { sql, eq, inArray, type SQL } from "drizzle-orm";
import type { Database } from "@atlasmed/database";

/**
 * MCP test data import pipeline:
 *   mcp_test (source) -> registry (CNES mirror) -> public (operational CRM data)
 *
 * Preserves: admin user, roles, territory types, IBGE territories (non-DEMO-*)
 *
 * Usage:
 *   bun run db:import:mcp-test -- --all --admin-email=admin@demo.atlasmed.local
 *   bun run db:import:mcp-test -- --clean --load-registry --sync-public --admin-email=admin@demo.atlasmed.local
 *
 * Phases:
 *   --analyze       Data quality report from mcp_test
 *   --clean         Wipe operational CRM data, keep admin + IBGE territories
 *   --load-registry Bulk copy mcp_test -> registry (25 tables)
 *   --sync-public   Bulk insert registry -> public facilities/professionals/associations
 *   --all           analyze + clean + load-registry + sync-public
 */

const SOURCE_SCHEMA = "mcp_test";
const REGISTRY_PROVIDER = "cnes";

const REGISTRY_TABLES = [
  "states",
  "municipalities",
  "agreement_types",
  "care_types",
  "deactivation_reasons",
  "equipment_categories",
  "equipment_catalog",
  "facility_types",
  "installation_subtypes",
  "physical_installation_types",
  "physical_installations",
  "occupations",
  "professional_councils",
  "service_specialties",
  "service_classifications",
  "maintainers",
  "facilities",
  "professionals",
  "facility_agreements",
  "facility_equipment",
  "facility_physical_installations",
  "facility_representatives",
  "facility_services",
  "facility_professionals",
  "professional_workload",
] as const;

interface ImportFilters {
  municipalityIds: string[];
  stateCodes: string[];
  activeOnly: boolean;
  withCoordsOnly: boolean;
  limit: number | null;
}

interface ImportOptions {
  analyze: boolean;
  clean: boolean;
  loadRegistry: boolean;
  syncPublic: boolean;
  geocodeMissing: boolean;
  dryRun: boolean;
  adminEmail: string | null;
  filters: ImportFilters;
}

function parseCsvArg(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseArgs(argv: string[]): ImportOptions {
  const municipalityArg = argv.find((arg) => arg.startsWith("--municipality-id="));
  const stateArg = argv.find((arg) => arg.startsWith("--state="));
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const adminArg = argv.find((arg) => arg.startsWith("--admin-email="));

  const runAll = argv.includes("--all");
  const analyze = argv.includes("--analyze") || runAll;
  const clean = argv.includes("--clean") || runAll;
  const loadRegistry = argv.includes("--load-registry") || runAll;
  const syncPublic = argv.includes("--sync-public") || runAll;

  if (!analyze && !clean && !loadRegistry && !syncPublic) {
    throw new Error(
      "Specify at least one phase: --analyze, --clean, --load-registry, --sync-public, or --all"
    );
  }

  return {
    analyze,
    clean,
    loadRegistry,
    syncPublic,
    geocodeMissing: argv.includes("--geocode-missing"),
    dryRun: argv.includes("--dry-run"),
    adminEmail:
      adminArg?.split("=")[1]?.trim() ||
      process.env.SEED_ADMIN_EMAIL ||
      process.env.KEEP_ADMIN_EMAIL ||
      null,
    filters: {
      municipalityIds: parseCsvArg(municipalityArg?.split("=")[1]),
      stateCodes: parseCsvArg(stateArg?.split("=")[1]).map((code) => code.toUpperCase()),
      activeOnly: !argv.includes("--include-deactivated"),
      withCoordsOnly: argv.includes("--with-coords-only"),
      limit: limitArg ? Number(limitArg.split("=")[1]) : null,
    },
  };
}

function buildFacilityFilterSql(filters: ImportFilters, alias = "f"): SQL {
  const clauses: SQL[] = [];

  if (filters.municipalityIds.length > 0) {
    clauses.push(
      sql`${sql.raw(alias)}.municipality_id IN (${sql.join(
        filters.municipalityIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );
  }

  if (filters.stateCodes.length > 0) {
    clauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${sql.raw(`${SOURCE_SCHEMA}.municipalities`)} m
        WHERE m.municipality_id = ${sql.raw(`${alias}.municipality_id`)}
          AND m.state_code IN (${sql.join(
            filters.stateCodes.map((c) => sql`${c}`),
            sql`, `
          )})
      )`
    );
  }

  if (filters.activeOnly) {
    clauses.push(
      sql`(${sql.raw(alias)}.deactivation_reason_code IS NULL OR trim(${sql.raw(alias)}.deactivation_reason_code) = '')`
    );
  }

  if (filters.withCoordsOnly) {
    clauses.push(
      sql`${sql.raw(alias)}.latitude IS NOT NULL AND ${sql.raw(alias)}.longitude IS NOT NULL`
    );
  }

  if (clauses.length === 0) {
    return sql`TRUE`;
  }

  return sql.join(clauses, sql` AND `);
}

async function resolveAdminUser(adminEmail: string | null) {
  if (adminEmail) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, adminEmail),
      with: { role: true },
    });

    if (!user) {
      throw new Error(`Admin user not found for email: ${adminEmail}`);
    }

    return user;
  }

  const admin = await db.query.users.findFirst({
    where: inArray(
      users.roleId,
      db.select({ id: roles.id }).from(roles).where(eq(roles.name, "ADMIN"))
    ),
    with: { role: true },
  });

  if (!admin) {
    throw new Error("No ADMIN user found. Pass --admin-email=... or seed an admin first.");
  }

  return admin;
}

async function analyzeSourceData(filters: ImportFilters) {
  console.log("\n📊 Analyzing mcp_test data quality...\n");

  const facilityFilter = buildFacilityFilterSql(filters, "f");

  type FacilityStats = {
    total: string;
    missing_coords: string;
    partial_coords: string;
    missing_address_parts: string;
    deactivated: string;
    missing_municipality: string;
  };

  const facilityResult = await db.execute<FacilityStats>(sql`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (
        WHERE f.latitude IS NULL AND f.longitude IS NULL
      )::bigint AS missing_coords,
      COUNT(*) FILTER (
        WHERE (f.latitude IS NULL) <> (f.longitude IS NULL)
      )::bigint AS partial_coords,
      COUNT(*) FILTER (
        WHERE coalesce(trim(f.street_address), '') = ''
      )::bigint AS missing_address_parts,
      COUNT(*) FILTER (
        WHERE coalesce(trim(f.deactivation_reason_code), '') <> ''
      )::bigint AS deactivated,
      COUNT(*) FILTER (
        WHERE f.municipality_id IS NULL OR trim(f.municipality_id) = ''
      )::bigint AS missing_municipality
    FROM ${sql.raw(`${SOURCE_SCHEMA}.facilities`)} f
    WHERE ${facilityFilter}
  `);
  const facilityStats = (facilityResult as unknown as FacilityStats[])[0];

  type AssociationStats = {
    total: string;
    facilities_in_scope: string;
    professionals_in_scope: string;
  };

  const associationResult = await db.execute<AssociationStats>(sql`
    WITH scoped_facilities AS (
      SELECT f.facility_id
      FROM ${sql.raw(`${SOURCE_SCHEMA}.facilities`)} f
      WHERE ${facilityFilter}
    )
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(DISTINCT fp.facility_id)::bigint AS facilities_in_scope,
      COUNT(DISTINCT fp.professional_id)::bigint AS professionals_in_scope
    FROM ${sql.raw(`${SOURCE_SCHEMA}.facility_professionals`)} fp
    INNER JOIN scoped_facilities sf ON sf.facility_id = fp.facility_id
  `);
  const associationStats = (associationResult as unknown as AssociationStats[])[0];

  type ProfessionalStats = {
    total: string;
    missing_tax_id: string;
    missing_name: string;
    missing_crm: string;
  };

  const professionalResult = await db.execute<ProfessionalStats>(sql`
    WITH scoped_professionals AS (
      SELECT DISTINCT fp.professional_id
      FROM ${sql.raw(`${SOURCE_SCHEMA}.facility_professionals`)} fp
      INNER JOIN ${sql.raw(`${SOURCE_SCHEMA}.facilities`)} f ON f.facility_id = fp.facility_id
      WHERE ${facilityFilter}
    )
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (
        WHERE coalesce(trim(p.tax_id), '') = ''
      )::bigint AS missing_tax_id,
      COUNT(*) FILTER (
        WHERE coalesce(trim(p.full_name), '') = ''
      )::bigint AS missing_name,
      COUNT(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1
          FROM ${sql.raw(`${SOURCE_SCHEMA}.professional_workload`)} w
          WHERE w.professional_id = p.professional_id
            AND (
              coalesce(trim(w.license_number), '') <> ''
              OR coalesce(trim(w.license_state), '') <> ''
              OR coalesce(trim(w.professional_council_code), '') <> ''
            )
        )
      )::bigint AS missing_crm
    FROM ${sql.raw(`${SOURCE_SCHEMA}.professionals`)} p
    INNER JOIN scoped_professionals sp ON sp.professional_id = p.professional_id
  `);
  const professionalStats = (professionalResult as unknown as ProfessionalStats[])[0];

  type RepresentativeStats = {
    total: string;
    missing_email: string;
    missing_tax_id: string;
  };

  const representativeResult = await db.execute<RepresentativeStats>(sql`
    WITH scoped_facilities AS (
      SELECT f.facility_id
      FROM ${sql.raw(`${SOURCE_SCHEMA}.facilities`)} f
      WHERE ${facilityFilter}
    )
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (
        WHERE coalesce(trim(r.email), '') = ''
      )::bigint AS missing_email,
      COUNT(*) FILTER (
        WHERE coalesce(trim(r.tax_id), '') = ''
      )::bigint AS missing_tax_id
    FROM ${sql.raw(`${SOURCE_SCHEMA}.facility_representatives`)} r
    INNER JOIN scoped_facilities sf ON sf.facility_id = r.facility_id
  `);
  const representativeStats = (representativeResult as unknown as RepresentativeStats[])[0];

  const report = {
    scope: {
      municipalityIds: filters.municipalityIds,
      stateCodes: filters.stateCodes,
      activeOnly: filters.activeOnly,
      withCoordsOnly: filters.withCoordsOnly,
      limit: filters.limit,
    },
    facilities: {
      total: Number(facilityStats?.total ?? 0),
      missingCoordinates: Number(facilityStats?.missing_coords ?? 0),
      partialCoordinates: Number(facilityStats?.partial_coords ?? 0),
      missingStreetAddress: Number(facilityStats?.missing_address_parts ?? 0),
      deactivated: Number(facilityStats?.deactivated ?? 0),
      missingMunicipality: Number(facilityStats?.missing_municipality ?? 0),
      skippedNoLocation: Number(facilityStats?.missing_coords ?? 0),
    },
    associations: {
      total: Number(associationStats?.total ?? 0),
      facilitiesInScope: Number(associationStats?.facilities_in_scope ?? 0),
      professionalsInScope: Number(associationStats?.professionals_in_scope ?? 0),
    },
    professionals: {
      total: Number(professionalStats?.total ?? 0),
      missingTaxId: Number(professionalStats?.missing_tax_id ?? 0),
      missingName: Number(professionalStats?.missing_name ?? 0),
      missingCrm: Number(professionalStats?.missing_crm ?? 0),
    },
    representatives: {
      total: Number(representativeStats?.total ?? 0),
      missingEmail: Number(representativeStats?.missing_email ?? 0),
      missingTaxId: Number(representativeStats?.missing_tax_id ?? 0),
    },
  };

  console.log(JSON.stringify(report, null, 2));
  return report;
}

function getRawCount(result: unknown): number {
  if (result && typeof result === "object" && "count" in result) {
    return Number((result as { count: unknown }).count ?? 0);
  }
  return 0;
}

async function cleanOperationalData(adminUserId: string, dryRun: boolean) {
  console.log("\n🧹 Cleaning operational data (keeping admin user and IBGE territories)...");

  const steps: Array<{ label: string; run: () => Promise<{ count: number }> }> = [
    {
      label: "audit logs",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.audit_logs`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "ingestion suggestions",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.ingestion_suggestions`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "facility professionals",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.facility_professionals`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "facility representatives",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.facility_representatives`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "facility consultant assignments",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.facility_consultant_assignments`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "facility healthcare provider shares",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.facility_healthcare_provider_shares`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "conformity records",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.conformity_records`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "professionals",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.professionals`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "facilities",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.facilities`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "business_verticals",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.business_verticals`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "products",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.products`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "healthcare providers",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.healthcare_providers`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "ingestion runs",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.ingestion_runs`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "territory approval requests",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.territory_approval_requests`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "demo territory assignments",
      run: async () => {
        const demoTerrs = await db.$client.unsafe(
          `SELECT id FROM public.territories WHERE code LIKE 'DEMO-%'`
        );
        const ids: string[] = (demoTerrs as unknown as { id: string }[]).map((t) => t.id);
        if (ids.length === 0) return { count: 0 };

        const idList = ids.map((id) => `'${id}'`).join(", ");
        const r = await db.$client.unsafe(
          `DELETE FROM public.user_territory_assignments WHERE "territoryId" IN (${idList})`
        );
        return { count: getRawCount(r) };
      },
    },
    {
      label: "demo territories",
      run: async () => {
        const demoTerrs = await db.$client.unsafe(
          `SELECT id FROM public.territories WHERE code LIKE 'DEMO-%'`
        );
        const ids: string[] = (demoTerrs as unknown as { id: string }[]).map((t) => t.id);
        if (ids.length === 0) return { count: 0 };

        const idList = ids.map((id) => `'${id}'`).join(", ");
        const r = await db.$client.unsafe(
          `DELETE FROM public.territories WHERE id IN (${idList})`
        );
        return { count: getRawCount(r) };
      },
    },
    {
      label: "non-admin sessions",
      run: async () => {
        const r = await db.$client.unsafe(
          `DELETE FROM public.sessions WHERE "userId" != '${adminUserId}'`
        );
        return { count: getRawCount(r) };
      },
    },
    {
      label: "non-admin permissions",
      run: async () => {
        const r = await db.$client.unsafe(
          `DELETE FROM public.permissions WHERE "userId" != '${adminUserId}'`
        );
        return { count: getRawCount(r) };
      },
    },
    {
      label: "non-admin territory assignments",
      run: async () => {
        const r = await db.$client.unsafe(
          `DELETE FROM public.user_territory_assignments WHERE "userId" != '${adminUserId}'`
        );
        return { count: getRawCount(r) };
      },
    },
    {
      label: "invitations",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.invitations`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "password resets",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.password_resets`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "verification tokens",
      run: async () => {
        const r = await db.$client.unsafe(`DELETE FROM public.verification_tokens`);
        return { count: getRawCount(r) };
      },
    },
    {
      label: "non-admin users",
      run: async () => {
        const r = await db.$client.unsafe(
          `DELETE FROM public.users WHERE id != '${adminUserId}'`
        );
        return { count: getRawCount(r) };
      },
    },
  ];

  if (dryRun) {
    console.log("   (dry-run) Would execute cleanup steps:");
    for (const step of steps) {
      console.log(`   - ${step.label}`);
    }
    return;
  }

  for (const step of steps) {
    const result = await step.run();
    console.log(`   ✓ ${step.label}: ${result.count}`);
  }
}

async function loadRegistryFromSource(dryRun: boolean) {
  console.log(`\n📥 Loading registry schema from ${SOURCE_SCHEMA}...`);

  if (dryRun) {
    console.log("   (dry-run) Would truncate registry tables and copy all mcp_test tables.");
    return;
  }

  const tableList = REGISTRY_TABLES.map((table) => `registry.${table}`).join(", ");
  await db.$client.unsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);

  for (const table of REGISTRY_TABLES) {
    const startedAt = Date.now();
    const result = await db.$client.unsafe(`
      INSERT INTO registry.${table}
      SELECT * FROM ${SOURCE_SCHEMA}.${table}
    `);
    console.log(`   ✓ registry.${table}: ${getRawCount(result)} rows (${Date.now() - startedAt}ms)`);
  }
}

function facilityImportWhereSql(filters: ImportFilters): string {
  const clauses = [
    `COALESCE(NULLIF(trim(f.trade_name), ''), NULLIF(trim(f.legal_name), '')) IS NOT NULL`,
    `NOT (
      f.latitude IS NULL
      AND f.longitude IS NULL
      AND COALESCE(NULLIF(trim(f.street_address), ''), '') = ''
    )`,
  ];

  if (filters.municipalityIds.length > 0) {
    const ids = filters.municipalityIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(", ");
    clauses.push(`f.municipality_id IN (${ids})`);
  }

  if (filters.stateCodes.length > 0) {
    const states = filters.stateCodes.map((code) => `'${code.replace(/'/g, "''")}'`).join(", ");
    clauses.push(`EXISTS (
      SELECT 1 FROM registry.municipalities m
      WHERE m.municipality_id = f.municipality_id
        AND m.state_code IN (${states})
    )`);
  }

  if (filters.activeOnly) {
    clauses.push(
      `(f.deactivation_reason_code IS NULL OR trim(f.deactivation_reason_code) = '')`
    );
  }

  if (filters.withCoordsOnly) {
    clauses.push(`f.latitude IS NOT NULL AND f.longitude IS NOT NULL`);
  }

  return clauses.join("\n      AND ");
}

async function prepareImportScopeTables(database: Database) {
  console.log("   → preparing import scope temp tables...");
  const prepStartedAt = Date.now();
  await database.execute(sql.raw(`
    DROP TABLE IF EXISTS _import_facility_ids;
    CREATE TEMP TABLE _import_facility_ids AS
    SELECT "externalSourceId" AS facility_id
    FROM public.facilities
    WHERE "sourceProvider" = '${REGISTRY_PROVIDER}';
    CREATE INDEX _import_facility_ids_idx ON _import_facility_ids (facility_id);

    DROP TABLE IF EXISTS _import_professional_ids;
    CREATE TEMP TABLE _import_professional_ids AS
    SELECT DISTINCT fp.professional_id
    FROM registry.facility_professionals fp
    INNER JOIN _import_facility_ids iff ON iff.facility_id = fp.facility_id;
    CREATE INDEX _import_professional_ids_idx ON _import_professional_ids (professional_id);
  `));
  console.log(`   ✓ scope tables ready (${Date.now() - prepStartedAt}ms)`);
}

async function syncPublicFromRegistry(options: ImportOptions) {
  console.log("\n🔄 Syncing public schema from registry (bulk SQL)...");

  if (options.dryRun) {
    console.log("   (dry-run) Would bulk-insert facilities, professionals, associations, representatives.");
    return;
  }

  await db.$client.unsafe(`SET statement_timeout = 0`);

  const importStartedAt = Date.now();
  const facilityWhere = facilityImportWhereSql(options.filters);
  const limitClause = options.filters.limit ? `LIMIT ${options.filters.limit}` : "";

  const facilityInsertStartedAt = Date.now();
  const facilitiesResult = await db.$client.unsafe(`
    INSERT INTO public.facilities (
      id,
      name,
      address,
      "territoryId",
      "territoryAssignmentStatus",
      "territoryAssignmentSource",
      cnes_code,
      legal_name,
      trade_name,
      street_address,
      street_number,
      address_complement,
      neighborhood,
      postal_code,
      phone_number,
      fax_number,
      email,
      website_url,
      tax_id_cnpj,
      tax_id_cpf,
      owner_tax_id,
      facility_type_code,
      registry_deactivation_code,
      is_active_in_registry,
      reference_municipality_code,
      "conformityStatus",
      "sourceProvider",
      "externalSourceId",
      "sourcePresent",
      "sourceTracked",
      "createdAt",
      "updatedAt"
    )
    SELECT
      'cnes_f_' || f.facility_id,
      COALESCE(NULLIF(trim(f.trade_name), ''), NULLIF(trim(f.legal_name), '')),
      NULLIF(trim(BOTH FROM concat_ws(', ',
        NULLIF(trim(f.street_address), ''),
        NULLIF(trim(f.street_number), ''),
        NULLIF(trim(f.address_complement), ''),
        NULLIF(trim(f.neighborhood), ''),
        NULLIF(trim(f.postal_code), ''),
        NULLIF(trim(m.municipality_name), ''),
        NULLIF(trim(m.state_code), '')
      )), ''),
      NULL,
      'unassigned'::"TerritoryAssignmentStatus",
      'geo'::"TerritoryAssignmentSource",
      f.cnes_code,
      f.legal_name,
      f.trade_name,
      f.street_address,
      f.street_number,
      f.address_complement,
      f.neighborhood,
      f.postal_code,
      f.phone_number,
      f.fax_number,
      f.email,
      f.website_url,
      f.tax_id_cnpj,
      f.tax_id_cpf,
      f.owner_tax_id,
      f.facility_type_code,
      f.deactivation_reason_code,
      (f.deactivation_reason_code IS NULL OR trim(f.deactivation_reason_code) = ''),
      f.municipality_id,
      'INCOMPLETE'::"ConformityStatus",
      '${REGISTRY_PROVIDER}',
      f.facility_id,
      TRUE,
      TRUE,
      NOW(),
      NOW()
    FROM registry.facilities f
    LEFT JOIN registry.municipalities m ON m.municipality_id = f.municipality_id
    WHERE ${facilityWhere}
    ORDER BY f.facility_id
    ${limitClause}
    ON CONFLICT ("sourceProvider", "externalSourceId") DO NOTHING
  `);
  const facilitiesInserted = getRawCount(facilitiesResult);
  console.log(
    `   ✓ facilities: ${facilitiesInserted} rows (${Date.now() - facilityInsertStartedAt}ms)`
  );

  const scopedSync = await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET statement_timeout = 0`));
    await prepareImportScopeTables(tx as unknown as Database);

    const professionalsInsertStartedAt = Date.now();
    const professionalsResult = await tx.execute(sql.raw(`
      INSERT INTO public.professionals (
        id, "firstName", "lastName", full_name, social_name, tax_id,
        "sourceProvider", "externalSourceId", "sourcePresent", "sourceTracked",
        "createdAt", "updatedAt"
      )
      SELECT
        'cnes_p_' || p.professional_id,
        COALESCE(NULLIF(split_part(trim(p.full_name), ' ', 1), ''), trim(p.full_name)),
        COALESCE(
          NULLIF(trim(substring(trim(p.full_name) FROM position(' ' IN trim(p.full_name)) + 1)), ''),
          COALESCE(NULLIF(split_part(trim(p.full_name), ' ', 1), ''), trim(p.full_name))
        ),
        p.full_name, p.social_name, p.tax_id,
        '${REGISTRY_PROVIDER}', p.professional_id, TRUE, TRUE, NOW(), NOW()
      FROM registry.professionals p
      INNER JOIN _import_professional_ids ip ON ip.professional_id = p.professional_id
      ON CONFLICT ("sourceProvider", "externalSourceId") DO NOTHING
    `));
    const professionalsInserted = getRawCount(professionalsResult);
    console.log(`   ✓ professionals: ${professionalsInserted} rows (${Date.now() - professionalsInsertStartedAt}ms)`);

    const specialtyUpdateStartedAt = Date.now();
    const specialtiesResult = await tx.execute(sql.raw(`
      UPDATE public.professionals prof
      SET primary_specialty_label = sub.occupation_name
      FROM (
        SELECT DISTINCT ON (fp.professional_id) fp.professional_id, o.occupation_name
        FROM registry.facility_professionals fp
        INNER JOIN _import_facility_ids iff ON iff.facility_id = fp.facility_id
        INNER JOIN _import_professional_ids ip ON ip.professional_id = fp.professional_id
        LEFT JOIN registry.occupations o ON o.occupation_code = fp.occupation_code
        ORDER BY fp.professional_id, fp.facility_id, fp.occupation_code
      ) sub
      WHERE prof."sourceProvider" = '${REGISTRY_PROVIDER}'
        AND prof."externalSourceId" = sub.professional_id
    `));
    console.log(`   ✓ professional specialties: ${getRawCount(specialtiesResult)} rows (${Date.now() - specialtyUpdateStartedAt}ms)`);

    const crmUpdateStartedAt = Date.now();
    const crmResult = await tx.execute(sql.raw(`
      UPDATE public.professionals prof
      SET crm_council = w.professional_council_code,
          crm_number = w.license_number,
          crm_state = w.license_state
      FROM (
        SELECT DISTINCT ON (pw.professional_id)
          pw.professional_id, pw.professional_council_code, pw.license_number, pw.license_state
        FROM registry.professional_workload pw
        INNER JOIN _import_professional_ids ip ON ip.professional_id = pw.professional_id
        WHERE coalesce(trim(pw.license_number), '') <> ''
           OR coalesce(trim(pw.license_state), '') <> ''
           OR coalesce(trim(pw.professional_council_code), '') <> ''
        ORDER BY pw.professional_id,
          CASE WHEN coalesce(trim(pw.license_number), '') <> '' THEN 0 ELSE 1 END,
          pw.last_updated_date DESC NULLS LAST
      ) w
      WHERE prof."sourceProvider" = '${REGISTRY_PROVIDER}'
        AND prof."externalSourceId" = w.professional_id
    `));
    console.log(`   ✓ professional CRM fields: ${getRawCount(crmResult)} rows (${Date.now() - crmUpdateStartedAt}ms)`);

    const associationsInsertStartedAt = Date.now();
    const associationsResult = await tx.execute(sql.raw(`
      INSERT INTO public.facility_professionals (
        id, "facilityId", "professionalId", occupation_code, specialty_label,
        employment_type_code, source_occupation_code, "sourceActive",
        "sourceFirstSeenAt", "sourceLastSeenAt", "createdAt", "updatedAt"
      )
      SELECT
        'cnes_fp_' || fp.facility_id || '_' || fp.professional_id || '_' || fp.occupation_code,
        fac.id, prof.id, fp.occupation_code, o.occupation_name,
        fp.employment_type_code, fp.occupation_code, TRUE, NOW(), NOW(), NOW(), NOW()
      FROM registry.facility_professionals fp
      INNER JOIN _import_facility_ids iff ON iff.facility_id = fp.facility_id
      INNER JOIN public.facilities fac
        ON fac."sourceProvider" = '${REGISTRY_PROVIDER}' AND fac."externalSourceId" = fp.facility_id
      INNER JOIN public.professionals prof
        ON prof."sourceProvider" = '${REGISTRY_PROVIDER}' AND prof."externalSourceId" = fp.professional_id
      LEFT JOIN registry.occupations o ON o.occupation_code = fp.occupation_code
      ON CONFLICT ("facilityId", "professionalId", occupation_code) DO NOTHING
    `));
    const associationsInserted = getRawCount(associationsResult);
    console.log(`   ✓ facility_professionals: ${associationsInserted} rows (${Date.now() - associationsInsertStartedAt}ms)`);

    const representativesInsertStartedAt = Date.now();
    const representativesResult = await tx.execute(sql.raw(`
      INSERT INTO public.facility_representatives (
        id, "facilityId", representative_name, role_title, email, tax_id,
        contact_type, source_provider, external_source_key, source_active,
        "createdAt", "updatedAt"
      )
      SELECT
        'cnes_fr_' || r.facility_id || '_' || md5(r.representative_name),
        fac.id, r.representative_name, r.role_title, r.email,
        COALESCE(NULLIF(trim(r.tax_id), ''), r.representative_name),
        'PROFESSIONAL'::"ContactType", '${REGISTRY_PROVIDER}',
        COALESCE(NULLIF(trim(r.tax_id), ''), r.representative_name), TRUE, NOW(), NOW()
      FROM registry.facility_representatives r
      INNER JOIN _import_facility_ids iff ON iff.facility_id = r.facility_id
      INNER JOIN public.facilities fac
        ON fac."sourceProvider" = '${REGISTRY_PROVIDER}' AND fac."externalSourceId" = r.facility_id
      ON CONFLICT ("facilityId", external_source_key) DO NOTHING
    `));
    const representativesInserted = getRawCount(representativesResult);
    console.log(`   ✓ facility_representatives: ${representativesInserted} rows (${Date.now() - representativesInsertStartedAt}ms)`);

    const addressEnrichStartedAt = Date.now();
    const addressesResult = await tx.execute(sql.raw(`
      UPDATE public.facilities fac
      SET address = NULLIF(trim(BOTH FROM concat_ws(', ',
        NULLIF(trim(f.street_address), ''), NULLIF(trim(f.street_number), ''),
        NULLIF(trim(f.address_complement), ''), NULLIF(trim(f.neighborhood), ''),
        NULLIF(trim(f.postal_code), ''), NULLIF(trim(m.municipality_name), ''),
        NULLIF(trim(m.state_code), '')
      )), '')
      FROM registry.facilities f
      LEFT JOIN registry.municipalities m ON m.municipality_id = f.municipality_id
      WHERE fac."sourceProvider" = '${REGISTRY_PROVIDER}' AND fac."externalSourceId" = f.facility_id
    `));
    console.log(`   ✓ facility addresses enriched: ${getRawCount(addressesResult)} rows (${Date.now() - addressEnrichStartedAt}ms)`);

    return {
      professionalsInserted,
      associationsInserted,
      representativesInserted,
    };
  });

  const { professionalsInserted, associationsInserted, representativesInserted } = scopedSync;

  type CountSummary = {
    facilities: string;
    professionals: string;
    associations: string;
    representatives: string;
  };

  const countsResult = await db.execute<CountSummary>(sql`
    SELECT
      (SELECT COUNT(*)::bigint FROM public.facilities WHERE "sourceProvider" = ${REGISTRY_PROVIDER}) AS facilities,
      (SELECT COUNT(*)::bigint FROM public.professionals WHERE "sourceProvider" = ${REGISTRY_PROVIDER}) AS professionals,
      (SELECT COUNT(*)::bigint FROM public.facility_professionals fp
        INNER JOIN public.facilities f ON f.id = fp."facilityId"
        WHERE f."sourceProvider" = ${REGISTRY_PROVIDER}) AS associations,
      (SELECT COUNT(*)::bigint FROM public.facility_representatives fr
        INNER JOIN public.facilities f ON f.id = fr."facilityId"
        WHERE f."sourceProvider" = ${REGISTRY_PROVIDER}) AS representatives
  `);
  const counts = (countsResult as unknown as CountSummary[])[0];

  const stats = {
    facilitiesInserted,
    professionalsInserted,
    associationsInserted,
    representativesInserted,
    totals: {
      facilities: Number(counts?.facilities ?? 0),
      professionals: Number(counts?.professionals ?? 0),
      associations: Number(counts?.associations ?? 0),
      representatives: Number(counts?.representatives ?? 0),
    },
    elapsedMs: Date.now() - importStartedAt,
  };

  console.log(JSON.stringify(stats, null, 2));
  return stats;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const admin = await resolveAdminUser(options.adminEmail);

  console.log("🚀 MCP test import");
  console.log(`   Database: ${process.env.DATABASE_URL}`);
  console.log(`   Keeping admin: ${admin.email} (${admin.id})`);
  if (options.dryRun) {
    console.log("   Mode: dry-run");
  }

  if (options.analyze) {
    await analyzeSourceData(options.filters);
  }

  if (options.clean) {
    await cleanOperationalData(admin.id, options.dryRun);
  }

  if (options.loadRegistry) {
    await loadRegistryFromSource(options.dryRun);
  }

  if (options.syncPublic) {
    await syncPublicFromRegistry(options);
  }

  if (options.clean || options.loadRegistry || options.syncPublic) {
    type FinalSummary = {
      users: string;
      ibge_territories: string;
      registry_facilities: string;
      public_facilities: string;
      public_professionals: string;
      associations: string;
      representatives: string;
    };

    const summaryResult = await db.execute<FinalSummary>(sql`
      SELECT
        (SELECT COUNT(*)::bigint FROM public.users) AS users,
        (SELECT COUNT(*)::bigint FROM public.territories WHERE code NOT LIKE 'DEMO-%') AS ibge_territories,
        (SELECT COUNT(*)::bigint FROM registry.facilities) AS registry_facilities,
        (SELECT COUNT(*)::bigint FROM public.facilities WHERE "sourceProvider" = ${REGISTRY_PROVIDER}) AS public_facilities,
        (SELECT COUNT(*)::bigint FROM public.professionals WHERE "sourceProvider" = ${REGISTRY_PROVIDER}) AS public_professionals,
        (SELECT COUNT(*)::bigint FROM public.facility_professionals fp
          INNER JOIN public.facilities f ON f.id = fp."facilityId"
          WHERE f."sourceProvider" = ${REGISTRY_PROVIDER}) AS associations,
        (SELECT COUNT(*)::bigint FROM public.facility_representatives fr
          INNER JOIN public.facilities f ON f.id = fr."facilityId"
          WHERE f."sourceProvider" = ${REGISTRY_PROVIDER}) AS representatives
    `);
    const summary = (summaryResult as unknown as FinalSummary[])[0];

    console.log("\n📋 Final database summary:");
    console.log(
      JSON.stringify(
        {
          users: Number(summary?.users ?? 0),
          ibgeTerritories: Number(summary?.ibge_territories ?? 0),
          registryFacilities: Number(summary?.registry_facilities ?? 0),
          publicFacilities: Number(summary?.public_facilities ?? 0),
          publicProfessionals: Number(summary?.public_professionals ?? 0),
          associations: Number(summary?.associations ?? 0),
          representatives: Number(summary?.representatives ?? 0),
        },
        null,
        2
      )
    );
  }
}

main()
  .catch((error) => {
    console.error("Import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end();
  });
