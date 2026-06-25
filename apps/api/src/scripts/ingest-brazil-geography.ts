import "dotenv/config";
import { prisma } from "../infrastructure/database/prisma.client";
import { PrismaTerritoryRepository } from "../modules/territory/infrastructure/repositories/prisma/prisma-territory.repository";
import { PrismaTerritoryClosureRepository } from "../modules/territory/infrastructure/repositories/prisma/prisma-territory-closure.repository";
import { PrismaTerritorySpatialRepository } from "../modules/territory/infrastructure/repositories/prisma/prisma-territory-spatial.repository";
import { TerritoryClosureService } from "../modules/territory/application/services/territory-closure.service";
import type { GeoJsonGeometry } from "../modules/territory/application/interfaces/territory-spatial.repository.interface";
import type { TerritoryRecord } from "../modules/territory/application/interfaces/territory.repository.interface";
import { legacyNodeTypeForTypeSlug } from "../modules/territory/application/constants/territory-slug.constants";
import {
  BRAZIL_COUNTRY_CODE,
  BRAZIL_STATE_SIGLAS,
  IBGE_LOCALIDADES_BASE,
  IBGE_MALHAS_BASE,
  IBGE_REGIONS,
  regionSlugForIbgeRegionId,
  type BrazilStateSigla,
} from "./brazil-geography.constants";

const territoryRepository = new PrismaTerritoryRepository();
const closureRepository = new PrismaTerritoryClosureRepository();
const spatialRepository = new PrismaTerritorySpatialRepository();

type GeoJsonFeature = {
  type: "Feature";
  properties: { codarea?: string };
  geometry: GeoJsonGeometry;
};

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

type IbgeState = {
  id: number;
  sigla: string;
  nome: string;
  regiao: { id: number; sigla: string; nome: string };
};

type IbgeMunicipality = {
  id: number;
  nome: string;
  microrregiao: {
    mesorregiao: {
      UF: { sigla: string; regiao: { id: number } };
    };
  };
};

interface IngestStats {
  created: number;
  skipped: number;
  boundariesSaved: number;
}

interface IngestContext {
  dryRun: boolean;
  skipMunicipalities: boolean;
  stateFilter: BrazilStateSigla | null;
  stats: IngestStats;
  typeIds: Record<"country" | "region" | "state" | "intermediate", string>;
  municipalityNamesById: Map<number, IbgeMunicipality>;
  regionIdsBySlug: Map<string, string>;
  stateIdsBySigla: Map<string, string>;
  countryId: string | null;
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const skipMunicipalities = argv.includes("--skip-municipalities");
  const stateArg = argv.find((arg) => arg.startsWith("--state="));
  const stateFilter = stateArg
    ? (stateArg.split("=")[1]?.toUpperCase() as BrazilStateSigla)
    : null;

  if (stateFilter && !BRAZIL_STATE_SIGLAS.includes(stateFilter)) {
    throw new Error(`Unknown state '${stateFilter}'. Use a two-letter UF code.`);
  }

  return { dryRun, skipMunicipalities, stateFilter };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function fetchMalha(path: string, intrarregiao?: string): Promise<GeoJsonFeatureCollection> {
  const params = new URLSearchParams({
    formato: "application/vnd.geo+json",
    qualidade: "intermediaria",
  });
  if (intrarregiao) {
    params.set("intrarregiao", intrarregiao);
  }
  const url = `${IBGE_MALHAS_BASE}/${path}?${params.toString()}`;
  return fetchJson<GeoJsonFeatureCollection>(url);
}

async function loadTerritoryTypeIds(): Promise<IngestContext["typeIds"]> {
  const types = await prisma.territoryType.findMany({
    where: { slug: { in: ["country", "region", "state", "intermediate"] } },
    select: { id: true, slug: true },
  });

  const bySlug = Object.fromEntries(types.map((type) => [type.slug, type.id]));

  for (const slug of ["country", "region", "state", "intermediate"] as const) {
    if (!bySlug[slug]) {
      throw new Error(`Missing territory type '${slug}'. Run database migrations first.`);
    }
  }

  return {
    country: bySlug.country!,
    region: bySlug.region!,
    state: bySlug.state!,
    intermediate: bySlug.intermediate!,
  };
}

async function loadMunicipalityMetadata(): Promise<Map<number, IbgeMunicipality>> {
  const municipalities = await fetchJson<IbgeMunicipality[]>(
    `${IBGE_LOCALIDADES_BASE}/municipios`
  );
  return new Map(municipalities.map((municipality) => [municipality.id, municipality]));
}

async function ensureTerritory(
  ctx: IngestContext,
  input: {
    name: string;
    slug: string;
    code: string;
    typeSlug: keyof IngestContext["typeIds"];
    parentId: string | null;
    countryCode: string;
    regionSlug?: string | null;
    stateCode?: string | null;
    geometry: GeoJsonGeometry;
  }
): Promise<TerritoryRecord | null> {
  const existing = await territoryRepository.findBySlug(input.slug);
  if (existing) {
    ctx.stats.skipped += 1;

    if (!ctx.dryRun) {
      const needsUpdate =
        existing.name !== input.name ||
        existing.parentId !== input.parentId ||
        existing.regionSlug !== (input.regionSlug ?? null) ||
        existing.stateCode !== (input.stateCode ?? null);

      if (needsUpdate) {
        await prisma.territory.update({
          where: { id: existing.id },
          data: {
            name: input.name,
            parentId: input.parentId,
            regionSlug: input.regionSlug ?? null,
            stateCode: input.stateCode ?? null,
            parentAssignmentStatus: "resolved",
            parentAssignmentSource: "manual",
            isActive: true,
          },
        });
      } else if (!existing.isActive) {
        await prisma.territory.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }

      if (!(await spatialRepository.hasBoundary(existing.id))) {
        await spatialRepository.saveBoundary(existing.id, input.geometry, {
          repairInvalid: true,
        });
        ctx.stats.boundariesSaved += 1;
      }
    }

    return existing;
  }

  if (ctx.dryRun) {
    ctx.stats.created += 1;
    console.log(`   [dry-run] would create ${input.typeSlug}: ${input.name} (${input.slug})`);
    return null;
  }

  const territory = await territoryRepository.create({
    name: input.name,
    slug: input.slug,
    code: input.code,
    nodeType: legacyNodeTypeForTypeSlug(input.typeSlug),
    territoryTypeId: ctx.typeIds[input.typeSlug],
    countryCode: input.countryCode,
    regionSlug: input.regionSlug ?? null,
    stateCode: input.stateCode ?? null,
    parentId: input.parentId,
    parentAssignmentStatus: "resolved",
    parentAssignmentSource: "manual",
  });

  await spatialRepository.saveBoundary(territory.id, input.geometry, { repairInvalid: true });
  ctx.stats.created += 1;
  ctx.stats.boundariesSaved += 1;
  return territory;
}

async function ingestCountry(ctx: IngestContext): Promise<string> {
  console.log("\n🇧🇷 Ingesting country boundary...");

  if (!ctx.dryRun) {
    await prisma.territory.updateMany({
      where: {
        isActive: true,
        countryCode: BRAZIL_COUNTRY_CODE,
        territoryType: { isCountryLevel: true },
        slug: { not: "br" },
      },
      data: { isActive: false },
    });
  }

  const collection = await fetchMalha("paises/BR");
  const feature = collection.features[0];
  if (!feature) {
    throw new Error("IBGE country malha returned no features");
  }

  const territory = await ensureTerritory(ctx, {
    name: "Brasil",
    slug: "br",
    code: BRAZIL_COUNTRY_CODE,
    typeSlug: "country",
    parentId: null,
    countryCode: BRAZIL_COUNTRY_CODE,
    geometry: feature.geometry,
  });

  const countryId =
    territory?.id ??
    (await territoryRepository.findBySlug("br"))?.id ??
    (ctx.dryRun ? "dry-run-br" : null);
  if (!countryId) {
    throw new Error("Failed to resolve Brazil country territory id");
  }

  ctx.countryId = countryId;
  return countryId;
}

async function ingestRegions(ctx: IngestContext, countryId: string): Promise<void> {
  console.log("\n🗺️  Ingesting macro-regions...");

  for (const region of IBGE_REGIONS) {
    const collection = await fetchMalha(`regioes/${region.id}`);
    const feature = collection.features[0];
    if (!feature) {
      throw new Error(`IBGE region malha returned no features for ${region.name}`);
    }

    const territory = await ensureTerritory(ctx, {
      name: region.name,
      slug: region.slug,
      code: `${BRAZIL_COUNTRY_CODE}-MACRO-${region.sigla}`,
      typeSlug: "region",
      parentId: countryId,
      countryCode: BRAZIL_COUNTRY_CODE,
      regionSlug: region.slug,
      geometry: feature.geometry,
    });

    const regionId =
      territory?.id ??
      (await territoryRepository.findBySlug(region.slug))?.id ??
      (ctx.dryRun ? `dry-run-${region.slug}` : null);
    if (!regionId) {
      throw new Error(`Failed to resolve region territory id for ${region.slug}`);
    }

    ctx.regionIdsBySlug.set(region.slug, regionId);
    console.log(`   ✓ ${region.name}`);
  }
}

async function ingestStates(ctx: IngestContext): Promise<void> {
  console.log("\n🏛️  Ingesting states (UF)...");

  const states = await fetchJson<IbgeState[]>(`${IBGE_LOCALIDADES_BASE}/estados`);
  const statesBySigla = new Map(states.map((state) => [state.sigla, state]));

  for (const sigla of BRAZIL_STATE_SIGLAS) {
    if (ctx.stateFilter && sigla !== ctx.stateFilter) {
      continue;
    }

    const state = statesBySigla.get(sigla);
    if (!state) {
      throw new Error(`IBGE metadata missing state ${sigla}`);
    }

    const regionSlug = regionSlugForIbgeRegionId(state.regiao.id);
    const regionId = ctx.regionIdsBySlug.get(regionSlug);
    if (!regionId) {
      throw new Error(`Region '${regionSlug}' must be ingested before state ${sigla}`);
    }

    const collection = await fetchMalha(`estados/${sigla}`);
    const feature = collection.features[0];
    if (!feature) {
      throw new Error(`IBGE state malha returned no features for ${sigla}`);
    }

    const slug = sigla.toLowerCase();
    const territory = await ensureTerritory(ctx, {
      name: state.nome,
      slug,
      code: `${BRAZIL_COUNTRY_CODE}-UF-${sigla}`,
      typeSlug: "state",
      parentId: regionId,
      countryCode: BRAZIL_COUNTRY_CODE,
      regionSlug,
      stateCode: sigla,
      geometry: feature.geometry,
    });

    const stateId =
      territory?.id ??
      (await territoryRepository.findBySlug(slug))?.id ??
      (ctx.dryRun ? `dry-run-${slug}` : null);
    if (!stateId) {
      throw new Error(`Failed to resolve state territory id for ${sigla}`);
    }

    ctx.stateIdsBySigla.set(sigla, stateId);
    console.log(`   ✓ ${state.nome} (${sigla}) → ${regionSlug}`);
  }
}

async function ingestMunicipalitiesForState(
  ctx: IngestContext,
  sigla: BrazilStateSigla
): Promise<void> {
  const stateId = ctx.stateIdsBySigla.get(sigla);
  if (!stateId) {
    throw new Error(`State ${sigla} must be ingested before municipalities`);
  }

  const collection = await fetchMalha(`estados/${sigla}`, "municipio");
  const features = collection.features;
  let createdInState = 0;

  for (const feature of features) {
    const ibgeCode = feature.properties.codarea;
    if (!ibgeCode) {
      continue;
    }

    const municipalityId = Number(ibgeCode);
    const metadata = ctx.municipalityNamesById.get(municipalityId);
    const name = metadata?.nome ?? `Município ${ibgeCode}`;
    const regionSlug = metadata
      ? regionSlugForIbgeRegionId(metadata.microrregiao.mesorregiao.UF.regiao.id)
      : null;

    const slug = `mun-${ibgeCode}`;
    const territory = await ensureTerritory(ctx, {
      name,
      slug,
      code: ibgeCode,
      typeSlug: "intermediate",
      parentId: stateId,
      countryCode: BRAZIL_COUNTRY_CODE,
      regionSlug,
      stateCode: sigla,
      geometry: feature.geometry,
    });

    if (territory) {
      createdInState += 1;
    }
  }

  console.log(
    `   ✓ ${sigla}: ${features.length} municipalities (${createdInState} new, ${ctx.stats.skipped} skipped total)`
  );
}

async function ingestMunicipalities(ctx: IngestContext): Promise<void> {
  console.log("\n🏘️  Ingesting municipalities...");

  for (const sigla of BRAZIL_STATE_SIGLAS) {
    if (ctx.stateFilter && sigla !== ctx.stateFilter) {
      continue;
    }
    await ingestMunicipalitiesForState(ctx, sigla);
  }
}

async function rebuildClosure(ctx: IngestContext): Promise<void> {
  if (ctx.dryRun) {
    console.log("\n↻ Skipping closure rebuild in dry-run mode");
    return;
  }

  console.log("\n↻ Rebuilding territory closure table...");
  const closureService = new TerritoryClosureService({
    territoryRepository,
    closureRepository,
  });
  await closureService.rebuildAll();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("\n🌎 Brazil geography ingestion");
  console.log("   Source: IBGE malhas API (same data as carolinabigonha/br-atlas)");
  if (args.dryRun) {
    console.log("   Mode: dry-run (no database writes)");
  }
  if (args.skipMunicipalities) {
    console.log("   Skipping municipalities");
  }
  if (args.stateFilter) {
    console.log(`   State filter: ${args.stateFilter}`);
  }

  const ctx: IngestContext = {
    dryRun: args.dryRun,
    skipMunicipalities: args.skipMunicipalities,
    stateFilter: args.stateFilter,
    stats: { created: 0, skipped: 0, boundariesSaved: 0 },
    typeIds: await loadTerritoryTypeIds(),
    municipalityNamesById: await loadMunicipalityMetadata(),
    regionIdsBySlug: new Map(),
    stateIdsBySigla: new Map(),
    countryId: null,
  };

  const countryId = await ingestCountry(ctx);
  await ingestRegions(ctx, countryId);
  await ingestStates(ctx);

  if (!args.skipMunicipalities) {
    await ingestMunicipalities(ctx);
  }

  await rebuildClosure(ctx);

  console.log("\n✅ Ingestion complete");
  console.log(`   Created: ${ctx.stats.created}`);
  console.log(`   Skipped (already existed): ${ctx.stats.skipped}`);
  console.log(`   Boundaries saved: ${ctx.stats.boundariesSaved}`);
  console.log("\nHierarchy: Brasil → 5 macro-regions → 27 states → municipalities\n");
}

main()
  .catch((error) => {
    console.error("\n❌ Ingestion failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
