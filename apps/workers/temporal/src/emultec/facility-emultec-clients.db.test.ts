import { describe, expect, test } from "bun:test";
import {
  facilities,
  facilityEmultecClients,
  municipalities,
  states,
} from "@atlasmed/database";
import { eq, sql } from "drizzle-orm";
import { isDatabaseReachable, withRollback, type Tx } from "../test-utils/db-harness";

/**
 * The cardinality `facilities.id_cliente_emultec` could not express.
 *
 * Emultec models a surgeon operating out of a clinic as their own pessoa-física
 * row pointing at the clinic through `Id_Cliente_PJ`. COT Centro Ortopédico has
 * five such clientes; 54 parent CNPJs carry 175 between them. A column on
 * `facilities` holds exactly one, so it silently kept whichever was written
 * first and named a representative rather than the client.
 *
 * These assertions are about the database's own guarantees, so a fake proves
 * nothing — only a real Postgres enforces (or fails to enforce) a primary key.
 */
const dbUp = await isDatabaseReachable();

interface Geo {
  stateId: number;
  municipalityId: number;
}

/**
 * One state and municipality per test, reused by every facility it seeds.
 *
 * `states.abbreviation` and `states.ibge_id` are both UNIQUE and the
 * abbreviation is two characters, so seeding geography per *facility* collides
 * the moment a test needs two clinics — which every test here does.
 */
async function seedGeo(tx: Tx): Promise<Geo> {
  const suffix = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
  const [state] = await tx
    .insert(states)
    .values({
      name: `T-State-${suffix}`,
      ibgeId: `T${suffix}`.slice(0, 12),
      abbreviation: suffix.slice(-2).toUpperCase(),
    })
    .returning({ id: states.id });
  const [municipality] = await tx
    .insert(municipalities)
    .values({
      stateId: state!.id,
      name: `T-City-${suffix}`,
      ibgeId: `T${suffix}`.slice(0, 12),
    })
    .returning({ id: municipalities.id });
  return { stateId: state!.id, municipalityId: municipality!.id };
}

async function seedFacility(tx: Tx, geo: Geo, name: string): Promise<number> {
  const [facility] = await tx
    .insert(facilities)
    .values({
      displayName: name,
      legalDocumentType: "CNPJ",
      stateId: geo.stateId,
      municipalityId: geo.municipalityId,
      // Spec 0009 R5: every clinic has a position.
      location: sql`ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326)`,
    })
    .returning({ id: facilities.id });
  return facility!.id;
}

describe.skipIf(!dbUp)("facility ↔ Emultec client links (database)", () => {
  test("one clinic holds several Emultec clientes", async () => {
    await withRollback(async (tx) => {
      const geo = await seedGeo(tx);
      const facilityId = await seedFacility(tx, geo, "COT TESTE");
      const clientes = [9_100_001, 9_100_002, 9_100_003, 9_100_004, 9_100_005];

      await tx.insert(facilityEmultecClients).values(
        clientes.map((idClienteEmultec) => ({
          idClienteEmultec,
          facilityId,
          source: "AUTO_CNPJ" as const,
        })),
      );

      const rows = await tx
        .select({ id: facilityEmultecClients.idClienteEmultec })
        .from(facilityEmultecClients)
        .where(eq(facilityEmultecClients.facilityId, facilityId));

      expect(rows.map((r) => r.id).sort()).toEqual(clientes);
    });
  });

  test("one Emultec cliente cannot claim two clinics", async () => {
    await withRollback(async (tx) => {
      const geo = await seedGeo(tx);
      const first = await seedFacility(tx, geo, "CLINICA A");
      const second = await seedFacility(tx, geo, "CLINICA B");
      const idClienteEmultec = 9_200_001;

      await tx.insert(facilityEmultecClients).values({
        idClienteEmultec,
        facilityId: first,
        source: "MANUAL",
      });

      // The constraint worth keeping from the old unique index: two clinics
      // claiming one client is a conflict to surface, not to resolve silently.
      //
      // Inside a SAVEPOINT (`tx.transaction`) because a failed statement aborts
      // the enclosing transaction in Postgres — asserting the violation directly
      // on `tx` would poison the harness's rollback and fail the test for the
      // wrong reason.
      await expect(
        tx.transaction(async (sp) => {
          await sp.insert(facilityEmultecClients).values({
            idClienteEmultec,
            facilityId: second,
            source: "AUTO_CNPJ",
          });
        }),
        // Drizzle wraps the driver error, so the primary-key detail sits on the
        // cause rather than the message — assert the write was rejected, then
        // prove what matters: the original link is untouched.
      ).rejects.toThrow();

      // The original link survives the rejected write.
      const [row] = await tx
        .select({ facilityId: facilityEmultecClients.facilityId })
        .from(facilityEmultecClients)
        .where(eq(facilityEmultecClients.idClienteEmultec, idClienteEmultec));
      expect(row?.facilityId).toBe(first);
    });
  });

  test("re-linking an existing cliente leaves the original clinic alone", async () => {
    await withRollback(async (tx) => {
      const geo = await seedGeo(tx);
      const first = await seedFacility(tx, geo, "CLINICA ORIGINAL");
      const second = await seedFacility(tx, geo, "CLINICA NOVA");
      const idClienteEmultec = 9_300_001;

      await tx.insert(facilityEmultecClients).values({
        idClienteEmultec,
        facilityId: first,
        source: "MANUAL",
      });

      // What the importer does on every resolve — must never repoint a link an
      // operator established.
      await tx
        .insert(facilityEmultecClients)
        .values({ idClienteEmultec, facilityId: second, source: "AUTO_CNPJ" })
        .onConflictDoNothing({ target: facilityEmultecClients.idClienteEmultec });

      const [row] = await tx
        .select({
          facilityId: facilityEmultecClients.facilityId,
          source: facilityEmultecClients.source,
        })
        .from(facilityEmultecClients)
        .where(eq(facilityEmultecClients.idClienteEmultec, idClienteEmultec));

      expect(row?.facilityId).toBe(first);
      expect(row?.source).toBe("MANUAL");
    });
  });

  test("deleting a clinic takes its links with it", async () => {
    await withRollback(async (tx) => {
      const geo = await seedGeo(tx);
      const facilityId = await seedFacility(tx, geo, "CLINICA EFEMERA");
      await tx.insert(facilityEmultecClients).values({
        idClienteEmultec: 9_400_001,
        facilityId,
        source: "AUTO_CPF",
      });

      await tx.delete(facilities).where(eq(facilities.id, facilityId));

      const rows = await tx
        .select({ id: facilityEmultecClients.idClienteEmultec })
        .from(facilityEmultecClients)
        .where(eq(facilityEmultecClients.facilityId, facilityId));

      expect(rows).toHaveLength(0);
    });
  });
});
