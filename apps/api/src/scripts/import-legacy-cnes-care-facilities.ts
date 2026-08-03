/**
 * Import missing PJ clinics that appear on legacy MySQL avulsa orders and
 * match a CNES care-type establishment (tbEstabelecimento).
 *
 * Skips CENTRAL DE GESTAO / abastecimento / cooperativa-cessão, etc.
 * Creates public.facilities (source_provider=cnes) + ORTOPEDIA vertical profile.
 * If CNES unit already exists without CNPJ, fills CNPJ instead of inserting.
 *
 * Env:
 *   DATABASE_URL
 *   LEGACY_MYSQL_URL   mysql://user:pass@host:3306/atlasmed
 *   CNES_ESTAB_CSV     path to tbEstabelecimentoYYYYMM.csv
 *
 * Dry-run (default):
 *   bun src/scripts/import-legacy-cnes-care-facilities.ts
 *
 * Apply:
 *   APPLY=1 bun src/scripts/import-legacy-cnes-care-facilities.ts
 */
import "dotenv/config";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { and, eq, sql } from "drizzle-orm";
import mysql from "mysql2/promise";
import {
  businessVerticals,
  facilities,
  facilityVerticalProfiles,
} from "@atlasmed/database";
import { db } from "../infrastructure/database/db";

/** CNES TP_UNIDADE codes treated as patient-care sites. */
const CARE_TP_UNIDADE = new Set([
  "01", // POSTO DE SAUDE
  "02", // CENTRO DE SAUDE/UNIDADE BASICA
  "04", // POLICLINICA
  "05", // HOSPITAL GERAL
  "07", // HOSPITAL ESPECIALIZADO
  "15", // UNIDADE MISTA
  "20", // PRONTO SOCORRO GERAL
  "21", // PRONTO SOCORRO ESPECIALIZADO
  "22", // CONSULTORIO ISOLADO
  "36", // CLINICA/CENTRO DE ESPECIALIDADE
  "39", // SADT ISOLADO
  "42", // UNIDADE MOVEL PRE-HOSPITALAR
  "61", // CENTRO DE PARTO NORMAL
  "62", // HOSPITAL/DIA
  "69", // HEMOTERAPIA
  "70", // CAPS
  "72", // ATENCAO SAUDE INDIGENA
  "73", // PRONTO ATENDIMENTO
  "77", // HOME CARE
  "78", // REGIME RESIDENCIAL
  "79", // OFICINA ORTOPEDICA
]);

const CARE_RANK: Record<string, number> = {
  "05": 100,
  "07": 95,
  "62": 90,
  "36": 85,
  "04": 80,
  "73": 75,
  "20": 70,
  "21": 70,
  "22": 60,
  "39": 50,
  "02": 45,
  "01": 40,
  "15": 40,
  "77": 35,
  "79": 35,
};

type LegacyClient = {
  id: number;
  nome: string;
  razao: string;
  cnpj: string;
  tipoCliente: string;
  email: string;
  telefone: string;
  celular: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  orderCount: number;
};

type CnesUnit = {
  coUnidade: string;
  coCnes: string;
  tpUnidade: string;
  razao: string;
  fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  telefone: string;
  email: string;
  website: string;
  lat: number | null;
  lng: number | null;
  tipoEstab: string;
  desativado: boolean;
};

type PlanRow = {
  action: "insert" | "patch_cnpj";
  cnpj: string;
  legacyClientId: number;
  orderCount: number;
  tipoCliente: string;
  unit: CnesUnit;
  existingFacilityId?: string;
  displayName: string;
  legalName: string;
};

function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function dig14(value: string | null | undefined): string | null {
  const d = digits(value);
  return d.length === 14 ? d : null;
}

function pickEmail(raw: string): string | null {
  const first = raw
    .split(/[;,]/)
    .map((s) => s.trim())
    .find((s) => s.includes("@"));
  return first ?? null;
}

function parseCoord(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function csvSplit(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ";" && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

async function loadLegacyClients(mysqlUrl: string): Promise<Map<string, LegacyClient>> {
  const conn = await mysql.createConnection(mysqlUrl);
  try {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(`
      SELECT
        c.Id AS id,
        IFNULL(c.Nome, '') AS nome,
        IFNULL(c.Razao, '') AS razao,
        IFNULL(c.CNPJ, '') AS cnpj,
        IFNULL(c.Tipo_Cliente, '') AS tipoCliente,
        IFNULL(c.Email, '') AS email,
        IFNULL(c.Telefone, '') AS telefone,
        IFNULL(c.Celular, '') AS celular,
        IFNULL(c.Endereco, '') AS endereco,
        IFNULL(c.Numero, '') AS numero,
        IFNULL(c.Complemento, '') AS complemento,
        IFNULL(c.Bairro, '') AS bairro,
        IFNULL(c.Cidade, '') AS cidade,
        IFNULL(c.UF, '') AS uf,
        IFNULL(c.CEP, '') AS cep,
        (
          SELECT COUNT(*) FROM avulsa a WHERE a.Id_Cliente = c.Id
        ) AS orderCount
      FROM clientes c
      WHERE c.Id IN (SELECT DISTINCT Id_Cliente FROM avulsa WHERE Id_Cliente IS NOT NULL)
    `);

    const map = new Map<string, LegacyClient>();
    for (const row of rows) {
      const cnpj = dig14(String(row.cnpj ?? ""));
      if (!cnpj) continue;
      map.set(cnpj, {
        id: Number(row.id),
        nome: String(row.nome ?? ""),
        razao: String(row.razao ?? ""),
        cnpj,
        tipoCliente: String(row.tipoCliente ?? ""),
        email: String(row.email ?? ""),
        telefone: String(row.telefone ?? ""),
        celular: String(row.celular ?? ""),
        endereco: String(row.endereco ?? ""),
        numero: String(row.numero ?? ""),
        complemento: String(row.complemento ?? ""),
        bairro: String(row.bairro ?? ""),
        cidade: String(row.cidade ?? ""),
        uf: String(row.uf ?? ""),
        cep: String(row.cep ?? ""),
        orderCount: Number(row.orderCount ?? 0),
      });
    }
    return map;
  } finally {
    await conn.end();
  }
}

async function loadCnesCareUnitsByCnpj(
  csvPath: string,
  targetCnpjs: Set<string>,
): Promise<Map<string, CnesUnit[]>> {
  const stream = createReadStream(csvPath, { encoding: "latin1" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let headers: string[] | null = null;
  const byCnpj = new Map<string, CnesUnit[]>();
  let lineNo = 0;

  for await (const line of rl) {
    lineNo += 1;
    if (!headers) {
      headers = csvSplit(line).map((h) => h.replace(/^"|"$/g, "").trim());
      continue;
    }
    const cols = csvSplit(line);
    const get = (name: string) => {
      const idx = headers!.indexOf(name);
      if (idx < 0) return "";
      return (cols[idx] ?? "").replace(/^"|"$/g, "").trim();
    };

    const cnpj = dig14(get("NU_CNPJ"));
    if (!cnpj || !targetCnpjs.has(cnpj)) continue;

    const tp = get("TP_UNIDADE") || get("CO_TIPO_UNIDADE");
    if (!CARE_TP_UNIDADE.has(tp)) continue;

    const unit: CnesUnit = {
      coUnidade: get("CO_UNIDADE"),
      coCnes: get("CO_CNES"),
      tpUnidade: tp,
      razao: get("NO_RAZAO_SOCIAL"),
      fantasia: get("NO_FANTASIA"),
      logradouro: get("NO_LOGRADOURO"),
      numero: get("NU_ENDERECO"),
      complemento: get("NO_COMPLEMENTO"),
      bairro: get("NO_BAIRRO"),
      cep: get("CO_CEP"),
      telefone: get("NU_TELEFONE"),
      email: get("NO_EMAIL"),
      website: get("NO_URL"),
      lat: parseCoord(get("NU_LATITUDE")),
      lng: parseCoord(get("NU_LONGITUDE")),
      tipoEstab: get("CO_TIPO_ESTABELECIMENTO"),
      desativado: Boolean(get("CO_MOTIVO_DESAB")),
    };
    if (!unit.coUnidade || !unit.coCnes) continue;

    const list = byCnpj.get(cnpj) ?? [];
    list.push(unit);
    byCnpj.set(cnpj, list);
  }

  console.log(`Scanned CNES CSV lines=${lineNo - 1}; care CNPJs matched=${byCnpj.size}`);
  return byCnpj;
}

function pickBestUnit(units: CnesUnit[]): CnesUnit {
  const scored = [...units].sort((a, b) => {
    const active = Number(!a.desativado) - Number(!b.desativado);
    if (active !== 0) return active > 0 ? -1 : 1;
    const rank = (CARE_RANK[b.tpUnidade] ?? 0) - (CARE_RANK[a.tpUnidade] ?? 0);
    if (rank !== 0) return rank;
    const geo = Number(b.lat != null && b.lng != null) - Number(a.lat != null && a.lng != null);
    if (geo !== 0) return geo;
    return a.coCnes.localeCompare(b.coCnes);
  });
  return scored[0]!;
}

async function main() {
  const apply = process.env.APPLY === "1";
  const mysqlUrl = process.env.LEGACY_MYSQL_URL;
  const csvPath = process.env.CNES_ESTAB_CSV;

  if (!mysqlUrl) throw new Error("LEGACY_MYSQL_URL is required");
  if (!csvPath) throw new Error("CNES_ESTAB_CSV is required");

  try {
    await run(apply, mysqlUrl, csvPath);
  } finally {
    await db.$client.end({ timeout: 2 }).catch(() => undefined);
  }
}

async function run(apply: boolean, mysqlUrl: string, csvPath: string) {
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);

  const existingCnpjRows = (await db.execute(sql`
    SELECT id, regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g') AS cnpj_digits
    FROM facilities
    WHERE cnpj IS NOT NULL AND btrim(cnpj) <> ''
  `)) as unknown as Array<{ id: string; cnpj_digits: string }>;

  const existingByCnpj = new Map<string, string>();
  for (const row of existingCnpjRows) {
    if (row.cnpj_digits?.length === 14) existingByCnpj.set(row.cnpj_digits, row.id);
  }

  const existingCnesRows = (await db.execute(sql`
    SELECT id, cnes_code, external_source_id, cnpj
    FROM facilities
    WHERE source_provider = 'cnes'
  `)) as unknown as Array<{
    id: string;
    cnes_code: string | null;
    external_source_id: string | null;
    cnpj: string | null;
  }>;

  const byCnesCode = new Map<string, (typeof existingCnesRows)[number]>();
  const byCoUnidade = new Map<string, (typeof existingCnesRows)[number]>();
  for (const row of existingCnesRows) {
    if (row.cnes_code) byCnesCode.set(row.cnes_code, row);
    if (row.external_source_id) byCoUnidade.set(row.external_source_id, row);
  }

  const legacy = await loadLegacyClients(mysqlUrl);
  const missing = new Map<string, LegacyClient>();
  for (const [cnpj, client] of legacy) {
    if (!existingByCnpj.has(cnpj)) missing.set(cnpj, client);
  }
  console.log(
    `Legacy avulsa CNPJ clients=${legacy.size}; missing in Atlas=${missing.size}`,
  );

  const cnesByCnpj = await loadCnesCareUnitsByCnpj(csvPath, new Set(missing.keys()));

  const [ortho] = await db
    .select({ id: businessVerticals.id })
    .from(businessVerticals)
    .where(eq(businessVerticals.code, "ORTOPEDIA"))
    .limit(1);
  if (!ortho) throw new Error("ORTOPEDIA vertical not found");

  const plan: PlanRow[] = [];
  let skippedNoCare = 0;
  let skippedNoCareOrders = 0;

  for (const [cnpj, client] of missing) {
    const units = cnesByCnpj.get(cnpj);
    if (!units?.length) {
      skippedNoCare += 1;
      skippedNoCareOrders += client.orderCount;
      continue;
    }
    const unit = pickBestUnit(units);
    const existing =
      byCoUnidade.get(unit.coUnidade) ?? byCnesCode.get(unit.coCnes) ?? null;

    const displayName =
      unit.fantasia || client.nome || unit.razao || client.razao || cnpj;
    const legalName = unit.razao || client.razao || displayName;

    if (existing) {
      const existingCnpj = dig14(existing.cnpj);
      if (existingCnpj) continue; // already has CNPJ; should have been in existingByCnpj
      plan.push({
        action: "patch_cnpj",
        cnpj,
        legacyClientId: client.id,
        orderCount: client.orderCount,
        tipoCliente: client.tipoCliente,
        unit,
        existingFacilityId: existing.id,
        displayName,
        legalName,
      });
      continue;
    }

    plan.push({
      action: "insert",
      cnpj,
      legacyClientId: client.id,
      orderCount: client.orderCount,
      tipoCliente: client.tipoCliente,
      unit,
      displayName,
      legalName,
    });
  }

  const inserts = plan.filter((p) => p.action === "insert");
  const patches = plan.filter((p) => p.action === "patch_cnpj");
  const orderCovered = plan.reduce((s, p) => s + p.orderCount, 0);

  console.log(`Plan: insert=${inserts.length} patch_cnpj=${patches.length}`);
  console.log(`Order coverage if applied: ${orderCovered}`);
  console.log(
    `Skipped missing CNPJ without care CNES unit: ${skippedNoCare} clients / ${skippedNoCareOrders} orders`,
  );

  for (const row of [...plan].sort((a, b) => b.orderCount - a.orderCount).slice(0, 15)) {
    console.log(
      `  ${row.action.padEnd(10)} orders=${String(row.orderCount).padStart(4)}  ${row.cnpj}  cnes=${row.unit.coCnes}  tp=${row.unit.tpUnidade}  ${row.displayName.slice(0, 40)}`,
    );
  }
  if (plan.length > 15) console.log(`  … +${plan.length - 15} more`);

  if (!apply) {
    console.log("\nDry-run only. Re-run with APPLY=1 to write facilities.");
    return;
  }

  let inserted = 0;
  let patched = 0;
  let profiles = 0;

  for (const row of plan) {
    const client = missing.get(row.cnpj)!;
    const phone =
      digits(row.unit.telefone) ||
      digits(client.telefone) ||
      digits(client.celular) ||
      null;
    const email =
      pickEmail(row.unit.email) || pickEmail(client.email) || null;
    const street =
      row.unit.logradouro || client.endereco || null;
    const number = row.unit.numero || client.numero || null;
    const complement = row.unit.complemento || client.complemento || null;
    const neighborhood = row.unit.bairro || client.bairro || null;
    const postal = digits(row.unit.cep) || digits(client.cep) || null;
    const city = client.cidade || null;
    const state = (client.uf || "").toUpperCase() || null;

    let facilityId = row.existingFacilityId;

    if (row.action === "patch_cnpj" && facilityId) {
      await db
        .update(facilities)
        .set({
          cnpj: row.cnpj,
          taxIdType: "PJ",
          updatedAt: new Date(),
          ...(email ? { email } : {}),
          ...(phone ? { phoneNumber: phone } : {}),
        })
        .where(eq(facilities.id, facilityId));
      patched += 1;
    } else {
      const hasGeo = row.unit.lat != null && row.unit.lng != null;
      const [created] = await db
        .insert(facilities)
        .values({
          displayName: row.displayName,
          tradeName: row.unit.fantasia || client.nome || null,
          legalName: row.legalName,
          taxIdType: "PJ",
          cnpj: row.cnpj,
          cnesCode: row.unit.coCnes,
          cnesUnitId: row.unit.coUnidade,
          unitTypeCode: row.unit.tpUnidade,
          facilityTypeCode: row.unit.tipoEstab || null,
          isActiveInRegistry: !row.unit.desativado,
          country: "BR",
          state,
          city,
          neighborhood,
          streetAddress: street,
          streetNumber: number,
          addressComplement: complement,
          postalCode: postal,
          phoneNumber: phone,
          email,
          websiteUrl: row.unit.website || null,
          sourceProvider: "cnes",
          externalSourceId: row.unit.coUnidade,
          sourcePresent: true,
          sourceTracked: true,
          sourceFirstSeenAt: new Date(),
          sourceLastSeenAt: new Date(),
          ...(hasGeo
            ? {
                location: sql`ST_SetSRID(ST_MakePoint(${row.unit.lng}, ${row.unit.lat}), 4326)`,
              }
            : {}),
        })
        .returning({ id: facilities.id });
      facilityId = created!.id;
      inserted += 1;
    }

    const [existingProfile] = await db
      .select({ id: facilityVerticalProfiles.id })
      .from(facilityVerticalProfiles)
      .where(
        and(
          eq(facilityVerticalProfiles.facilityId, facilityId!),
          eq(facilityVerticalProfiles.verticalId, ortho.id),
        ),
      )
      .limit(1);

    if (!existingProfile) {
      await db.insert(facilityVerticalProfiles).values({
        facilityId: facilityId!,
        verticalId: ortho.id,
        isActive: true,
        commercialStatus: "UNREGISTERED",
      });
      profiles += 1;
    } else {
      await db
        .update(facilityVerticalProfiles)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(facilityVerticalProfiles.id, existingProfile.id));
    }
  }

  console.log(
    `\nDone. inserted=${inserted} patched_cnpj=${patched} ortopedia_profiles_created=${profiles}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
