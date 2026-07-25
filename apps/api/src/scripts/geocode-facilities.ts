/**
 * Backfill / refresh facility coordinates via Mapbox forward geocoding.
 *
 * Query always includes city + state (required). Address is built with
 * composeAddressQuery (street, number, neighborhood, "City - UF", CEP, Brazil)
 * and Mapbox is called with country=br.
 *
 * Usage (from apps/api, with .env loaded):
 *
 *   # dry-run missing locations only (default)
 *   bun run db:geocode:facilities
 *
 *   # apply
 *   bun run db:geocode:facilities:apply
 *
 *   # re-geocode everyone that has city+state (fix wrong pins)
 *   bun run db:geocode:facilities:apply -- --all
 *
 *   # re-geocode only rows that already have a point
 *   bun run db:geocode:facilities:apply -- --refresh --concurrency=3 --delay-ms=50
 *
 *   # only excel-enrich rows
 *   bun run db:geocode:facilities:apply -- --source=excel-enrich
 *
 * Env: MAPBOX_SECRET_TOKEN (preferred) or MAPBOX_PUBLIC_TOKEN / MAPBOX_ACCESS_TOKEN
 *      DATABASE_URL
 */

import { sql } from "drizzle-orm";
import { createMapboxClient } from "@atlasmed/mapbox";
import { MapboxError } from "@atlasmed/mapbox";
import { db } from "../infrastructure/database/db";
import {
  composeAddressQuery,
  lookupBrazilianPostalCode,
  mergeAddressWithPostalLookup,
  pickBestGeocodeCandidate,
  type AddressParts,
  type PostalCodeLookup,
} from "../modules/facility/application/services/facility-geocoding.service";

const postalLookupCache = new Map<string, PostalCodeLookup | null>();

async function cachedPostalLookup(
  postalCode: string | null
): Promise<PostalCodeLookup | null> {
  if (!postalCode) return null;
  const digits = postalCode.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  if (postalLookupCache.has(digits)) {
    return postalLookupCache.get(digits) ?? null;
  }
  const lookup = await lookupBrazilianPostalCode(digits);
  postalLookupCache.set(digits, lookup);
  return lookup;
}

type Mode = "missing" | "all" | "refresh";

interface CliOptions {
  apply: boolean;
  mode: Mode;
  source: string | null;
  limit: number | null;
  delayMs: number;
  concurrency: number;
}

interface FacilityRow {
  id: string;
  name: string;
  street_address: string | null;
  street_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  source_provider: string | null;
  has_location: boolean;
}

/** Loose UF bounding boxes (WGS84) to reject wildly wrong Mapbox hits. */
const UF_BBOX: Record<
  string,
  { minLat: number; maxLat: number; minLng: number; maxLng: number }
> = {
  AC: { minLat: -11.2, maxLat: -7.1, minLng: -74.0, maxLng: -66.5 },
  AL: { minLat: -10.5, maxLat: -8.8, minLng: -38.3, maxLng: -35.1 },
  AM: { minLat: -9.9, maxLat: 2.3, minLng: -73.8, maxLng: -56.0 },
  AP: { minLat: -1.3, maxLat: 4.5, minLng: -54.9, maxLng: -49.8 },
  BA: { minLat: -18.4, maxLat: -8.5, minLng: -46.7, maxLng: -37.2 },
  CE: { minLat: -7.9, maxLat: -2.8, minLng: -41.5, maxLng: -37.2 },
  DF: { minLat: -16.1, maxLat: -15.5, minLng: -48.3, maxLng: -47.3 },
  ES: { minLat: -21.3, maxLat: -17.9, minLng: -42.0, maxLng: -39.6 },
  GO: { minLat: -19.5, maxLat: -12.4, minLng: -53.3, maxLng: -45.9 },
  MA: { minLat: -10.3, maxLat: -1.0, minLng: -48.8, maxLng: -41.7 },
  MG: { minLat: -22.9, maxLat: -14.2, minLng: -51.1, maxLng: -39.8 },
  MS: { minLat: -24.1, maxLat: -17.2, minLng: -58.2, maxLng: -50.9 },
  MT: { minLat: -18.1, maxLat: -7.3, minLng: -61.6, maxLng: -50.2 },
  PA: { minLat: -9.9, maxLat: 2.6, minLng: -58.9, maxLng: -46.0 },
  PB: { minLat: -8.4, maxLat: -6.0, minLng: -38.9, maxLng: -34.7 },
  PE: { minLat: -9.5, maxLat: -7.2, minLng: -41.4, maxLng: -34.7 },
  PI: { minLat: -10.9, maxLat: -2.7, minLng: -45.9, maxLng: -40.3 },
  PR: { minLat: -26.8, maxLat: -22.5, minLng: -54.7, maxLng: -48.0 },
  RJ: { minLat: -23.4, maxLat: -20.7, minLng: -44.9, maxLng: -40.9 },
  RN: { minLat: -6.9, maxLat: -4.8, minLng: -38.6, maxLng: -35.0 },
  RO: { minLat: -13.7, maxLat: -7.9, minLng: -66.9, maxLng: -59.7 },
  RR: { minLat: -1.6, maxLat: 5.3, minLng: -64.8, maxLng: -58.8 },
  RS: { minLat: -33.8, maxLat: -27.0, minLng: -57.7, maxLng: -49.6 },
  SC: { minLat: -29.4, maxLat: -25.9, minLng: -53.9, maxLng: -48.3 },
  SE: { minLat: -11.6, maxLat: -9.5, minLng: -38.3, maxLng: -36.3 },
  SP: { minLat: -25.4, maxLat: -19.7, minLng: -53.2, maxLng: -44.0 },
  TO: { minLat: -13.5, maxLat: -5.1, minLng: -50.8, maxLng: -45.6 },
};

const BR_BBOX = { minLat: -34.0, maxLat: 5.5, minLng: -74.5, maxLng: -32.0 };

function parseArgs(argv: string[]): CliOptions {
  let apply = false;
  let mode: Mode = "missing";
  let source: string | null = null;
  let limit: number | null = null;
  let delayMs = 150;
  let concurrency = 1;

  for (const arg of argv) {
    if (arg === "--apply") apply = true;
    else if (arg === "--all") mode = "all";
    else if (arg === "--missing") mode = "missing";
    else if (arg === "--refresh") mode = "refresh";
    else if (arg.startsWith("--source=")) source = arg.slice("--source=".length) || null;
    else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    } else if (arg.startsWith("--delay-ms=")) {
      const n = Number(arg.slice("--delay-ms=".length));
      if (Number.isFinite(n) && n >= 0) delayMs = Math.floor(n);
    } else if (arg.startsWith("--concurrency=")) {
      const n = Number(arg.slice("--concurrency=".length));
      if (Number.isFinite(n) && n >= 1) concurrency = Math.min(5, Math.floor(n));
    }
  }

  return { apply, mode, source, limit, delayMs, concurrency };
}

function mapboxToken(): string {
  const token =
    process.env.MAPBOX_SECRET_TOKEN ||
    process.env.MAPBOX_PUBLIC_TOKEN ||
    process.env.MAPBOX_ACCESS_TOKEN ||
    "";
  if (!token.trim()) {
    throw new Error(
      "Set MAPBOX_SECRET_TOKEN (preferred) or MAPBOX_PUBLIC_TOKEN / MAPBOX_ACCESS_TOKEN"
    );
  }
  return token.trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inBbox(
  lat: number,
  lng: number,
  box: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): boolean {
  return (
    lat >= box.minLat &&
    lat <= box.maxLat &&
    lng >= box.minLng &&
    lng <= box.maxLng
  );
}

function coordsPlausible(lat: number, lng: number, uf: string): boolean {
  if (!inBbox(lat, lng, BR_BBOX)) return false;
  const box = UF_BBOX[uf.toUpperCase()];
  if (!box) return true;
  return inBbox(lat, lng, box);
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

async function loadFacilities(opts: CliOptions): Promise<FacilityRow[]> {
  const filters: ReturnType<typeof sql>[] = [
    sql`deactivated_at is null`,
    sql`nullif(trim(city), '') is not null`,
    sql`nullif(trim(state), '') is not null`,
  ];

  if (opts.mode === "missing") {
    filters.push(sql`location is null`);
  } else if (opts.mode === "refresh") {
    filters.push(sql`location is not null`);
  }
  if (opts.source) {
    filters.push(sql`source_provider = ${opts.source}`);
  }

  const where = sql.join(filters, sql` and `);
  const limitSql =
    opts.limit != null ? sql`limit ${opts.limit}` : sql``;

  const result = (await db.execute(sql`
    select
      id,
      name,
      street_address,
      street_number,
      address_complement,
      neighborhood,
      city,
      state,
      postal_code,
      source_provider,
      (location is not null) as has_location
    from facilities
    where ${where}
    order by created_at, id
    ${limitSql}
  `)) as unknown as Record<string, unknown>[];

  return result.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    street_address: (row.street_address as string | null) ?? null,
    street_number: (row.street_number as string | null) ?? null,
    address_complement: (row.address_complement as string | null) ?? null,
    neighborhood: (row.neighborhood as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    postal_code: (row.postal_code as string | null) ?? null,
    source_provider: (row.source_provider as string | null) ?? null,
    has_location: Boolean(row.has_location),
  }));
}

async function persistLocation(
  id: string,
  lat: number,
  lng: number
): Promise<void> {
  await db.execute(sql`
    update facilities
    set
      location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
      updated_at = now()
    where id = ${id}
  `);
}

async function geocodeOne(
  client: ReturnType<typeof createMapboxClient>,
  row: FacilityRow,
  retries = 4
): Promise<
  | { ok: true; lat: number; lng: number; query: string; fullAddress?: string }
  | { ok: false; reason: string; query: string | null }
> {
  let city = row.city?.trim() ?? "";
  let state = row.state?.trim().toUpperCase().slice(0, 2) ?? "";
  if (!city || state.length !== 2) {
    return { ok: false, reason: "missing_city_or_state", query: null };
  }

  let addressParts: AddressParts = {
    streetAddress: row.street_address,
    streetNumber: row.street_number,
    neighborhood: row.neighborhood,
    city,
    state,
    postalCode: row.postal_code,
  };

  const postalLookup = await cachedPostalLookup(row.postal_code);
  if (postalLookup) {
    addressParts = mergeAddressWithPostalLookup(addressParts, postalLookup);
    city = addressParts.city?.trim() ?? city;
    state = addressParts.state?.trim().toUpperCase().slice(0, 2) ?? state;
  }

  const query = composeAddressQuery(addressParts, { includeCountry: false });

  if (!query) {
    return { ok: false, reason: "empty_query", query: null };
  }

  // Prefer queries that still surface city/UF even when street is thin.
  if (!query.includes(city) || !query.toUpperCase().includes(state)) {
    return { ok: false, reason: "query_missing_city_state", query };
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.geocodeForwardRaw({
        query,
        country: "br",
        language: "pt",
        limit: 5,
      });

      const candidates = response.features.map((feature) => {
        const [longitude, latitude] = feature.geometry.coordinates;
        return {
          latitude,
          longitude,
          fullAddress:
            feature.properties.full_address ??
            feature.properties.place_formatted,
          name: feature.properties.name,
        };
      });

      const best = pickBestGeocodeCandidate(candidates, {
        city,
        state,
        neighborhood: addressParts.neighborhood,
        postalCode: addressParts.postalCode,
      });

      if (!best) {
        return { ok: false, reason: "no_city_match", query };
      }

      if (!coordsPlausible(best.latitude, best.longitude, state)) {
        return {
          ok: false,
          reason: `outside_${state}_bbox`,
          query,
        };
      }

      return {
        ok: true,
        lat: best.latitude,
        lng: best.longitude,
        query,
        fullAddress: best.fullAddress,
      };
    } catch (error) {
      const status = error instanceof MapboxError ? error.statusCode : undefined;
      const retryable = status === 429 || (status != null && status >= 500);
      if (!retryable || attempt === retries) {
        const message =
          error instanceof Error ? error.message : String(error);
        return { ok: false, reason: `error:${message}`, query };
      }
      await sleep(500 * 2 ** attempt);
    }
  }

  return { ok: false, reason: "exhausted_retries", query };
}

async function main(): Promise<number> {
  const opts = parseArgs(process.argv.slice(2));
  const token = mapboxToken();
  const client = createMapboxClient({ accessToken: token });

  const rows = await loadFacilities(opts);
  const perRequestSec = Math.max(opts.delayMs, 50) / 1000 / opts.concurrency;
  const etaSec = rows.length * perRequestSec;

  console.log(`=== geocode-facilities [${opts.apply ? "APPLY" : "DRY-RUN"}] ===`);
  console.log(`mode: ${opts.mode}`);
  console.log(`source: ${opts.source ?? "(any)"}`);
  console.log(`candidates (city+state required): ${rows.length}`);
  console.log(
    `rate: concurrency=${opts.concurrency} delayMs=${opts.delayMs} → ~${formatEta(etaSec)} ETA`
  );
  console.log(
    "query shape: street/number, neighborhood, City - UF, CEP, Brazil (country=br)"
  );

  if (rows.length === 0) {
    console.log("Nothing to do.");
    return 0;
  }

  const stats = {
    ok: 0,
    skipped: 0,
    failed: 0,
    written: 0,
  };
  const sampleFails: string[] = [];

  let index = 0;
  async function worker(): Promise<void> {
    while (index < rows.length) {
      const i = index++;
      const row = rows[i]!;
      const result = await geocodeOne(client, row);

      if (!result.ok) {
        stats.failed += 1;
        if (sampleFails.length < 12) {
          sampleFails.push(
            `${row.name} [${row.city}/${row.state}] → ${result.reason}`
          );
        }
      } else {
        stats.ok += 1;
        if (opts.apply) {
          await persistLocation(row.id, result.lat, result.lng);
          stats.written += 1;
        }
      }

      if ((i + 1) % 25 === 0 || i + 1 === rows.length) {
        console.log(
          `  progress ${i + 1}/${rows.length} ok=${stats.ok} fail=${stats.failed}`
        );
      }

      if (opts.delayMs > 0) {
        await sleep(opts.delayMs);
      }
    }
  }

  await Promise.all(
    Array.from({ length: opts.concurrency }, () => worker())
  );

  console.log("\n--- stats ---");
  console.log(`  ok: ${stats.ok}`);
  console.log(`  failed: ${stats.failed}`);
  console.log(`  written: ${stats.written}`);
  console.log(`  skipped: ${stats.skipped}`);

  if (sampleFails.length) {
    console.log("\n--- sample failures ---");
    for (const line of sampleFails) {
      console.log(`  - ${line}`);
    }
  }

  if (!opts.apply) {
    console.log("\nDry-run only. Re-run with --apply to write locations.");
  }

  console.log("\nDone.");
  return 0;
}

try {
  process.exit(await main());
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
