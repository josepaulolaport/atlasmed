import { describe, expect, test } from "bun:test";
import {
  emultecOrderImportPending,
  facilities,
  facilityEmultecClients,
  municipalities,
  products,
  roles,
  states,
  users,
} from "@atlasmed/database";
import { eq, sql } from "drizzle-orm";
import {
  isDatabaseReachable,
  uniqueAbbreviation,
  withRollback,
  type Tx,
} from "../test-utils/db-harness";
import {
  listUnblockedEmultecOrderIds,
  recordEmultecSkip,
  resolveEmultecSkip,
} from "./emultec-skip-queue";

/**
 * The re-check is written in raw SQL against `text[]` and `bigint[]` columns —
 * `= ANY(...)`, a correlated `EXISTS` per blocker kind — none of which a fake
 * can evaluate. Either Postgres runs these predicates and returns the right ids
 * or the whole queue silently returns nothing, which looks exactly like "no
 * orders are ready" and is the failure this table exists to prevent.
 */
const dbUp = await isDatabaseReachable();

/** Avulsa ids are the PK; keep test rows far apart from each other. */
let nextAvulsa = 900_000_000 + Math.floor(Math.random() * 1_000_000);
function avulsaId(): number {
  nextAvulsa += 1;
  return nextAvulsa;
}

/** Digits-only documents that cannot collide with seeded or real facilities. */
function cnpjDigits(): string {
  return String(Math.floor(Math.random() * 1e14)).padStart(14, "9").slice(-14);
}
function cpfDigits(): string {
  return String(Math.floor(Math.random() * 1e11)).padStart(11, "8").slice(-11);
}

async function seedGeo(tx: Tx): Promise<{
  stateId: number;
  municipalityId: number;
}> {
  const suffix = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const [state] = await tx
    .insert(states)
    .values({
      name: `T-State-${suffix}`,
      ibgeId: `T${suffix}`.slice(0, 12),
      abbreviation: uniqueAbbreviation(),
    })
    .returning({ id: states.id });
  const [municipality] = await tx
    .insert(municipalities)
    .values({
      stateId: state!.id,
      name: `T-City-${suffix}`,
      ibgeId: `M${suffix}`.slice(0, 12),
    })
    .returning({ id: municipalities.id });
  return { stateId: state!.id, municipalityId: municipality!.id };
}

async function seedFacility(
  tx: Tx,
  geo: { stateId: number; municipalityId: number },
  document: string,
  options: { deactivated?: boolean } = {}
): Promise<number> {
  const [row] = await tx
    .insert(facilities)
    .values({
      displayName: `T-Facility-${document}`,
      legalDocument: document,
      legalDocumentType: document.length === 14 ? "CNPJ" : "CPF",
      stateId: geo.stateId,
      municipalityId: geo.municipalityId,
      // Spec 0009 R5: every clinic has a position.
      location: sql`ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326)`,
      deactivatedAt: options.deactivated ? new Date() : null,
    })
    .returning({ id: facilities.id });
  return row!.id;
}

describe.if(dbUp)("emultec skip queue", () => {
  test("records a skip and closes it when the order imports", async () => {
    await withRollback(async (tx) => {
      const idAvulsa = avulsaId();
      const detail = {
        reason: "seller_unmapped" as const,
        blocker: "SELLER" as const,
        idVendedorEmultec: 4_242,
      };

      await recordEmultecSkip({ idAvulsa, detail }, tx);
      await recordEmultecSkip({ idAvulsa, detail }, tx);

      const [open] = await tx
        .select()
        .from(emultecOrderImportPending)
        .where(eq(emultecOrderImportPending.idAvulsaEmultec, idAvulsa));

      // Second skip updates in place — one row per order, not one per attempt.
      expect(open?.skipCount).toBe(2);
      expect(open?.blocker).toBe("SELLER");
      expect(open?.resolvedAt).toBeNull();

      await resolveEmultecSkip(idAvulsa, tx);

      const [closed] = await tx
        .select()
        .from(emultecOrderImportPending)
        .where(eq(emultecOrderImportPending.idAvulsaEmultec, idAvulsa));
      expect(closed?.resolvedAt).not.toBeNull();
    });
  });

  test("a re-skip after a resolve reopens the row", async () => {
    await withRollback(async (tx) => {
      const idAvulsa = avulsaId();
      const detail = { reason: "seller_unmapped", blocker: "SELLER" as const };

      await recordEmultecSkip({ idAvulsa, detail }, tx);
      await resolveEmultecSkip(idAvulsa, tx);
      await recordEmultecSkip({ idAvulsa, detail }, tx);

      const [row] = await tx
        .select()
        .from(emultecOrderImportPending)
        .where(eq(emultecOrderImportPending.idAvulsaEmultec, idAvulsa));

      // A stale resolution would hide a live block from every future tick.
      expect(row?.resolvedAt).toBeNull();
    });
  });

  test("DOCUMENT clears once an active facility carries any tried document", async () => {
    await withRollback(async (tx) => {
      const geo = await seedGeo(tx);
      const parentCnpj = cnpjDigits();
      const ownCpf = cpfDigits();
      const idAvulsa = avulsaId();

      await recordEmultecSkip(
        {
          idAvulsa,
          detail: {
            reason: "facility_no_match",
            blocker: "DOCUMENT",
            idClienteEmultec: 5_555,
            blockerDocuments: [parentCnpj, ownCpf],
          },
        },
        tx
      );

      expect(await listUnblockedEmultecOrderIds({ limit: 50 }, tx)).not.toContain(
        idAvulsa
      );

      // The *second* document is the one that appears. A single-document column
      // would never have surfaced this order.
      await seedFacility(tx, geo, ownCpf);

      expect(await listUnblockedEmultecOrderIds({ limit: 50 }, tx)).toContain(
        idAvulsa
      );
    });
  });

  test("DOCUMENT ignores a deactivated facility", async () => {
    await withRollback(async (tx) => {
      const geo = await seedGeo(tx);
      const document = cnpjDigits();
      const idAvulsa = avulsaId();

      await seedFacility(tx, geo, document, { deactivated: true });
      await recordEmultecSkip(
        {
          idAvulsa,
          detail: {
            reason: "facility_no_match",
            blocker: "DOCUMENT",
            blockerDocuments: [document],
          },
        },
        tx
      );

      // Resolve only considers active facilities, so surfacing this order would
      // just skip it again on the next tick.
      expect(await listUnblockedEmultecOrderIds({ limit: 50 }, tx)).not.toContain(
        idAvulsa
      );
    });
  });

  test("facility_ambiguous clears through an operator link, not the documents", async () => {
    await withRollback(async (tx) => {
      const geo = await seedGeo(tx);
      const sharedCpf = cpfDigits();
      const idCliente = 6_666_001;
      const idAvulsa = avulsaId();

      // One surgeon, two consultórios — both legitimate, both active. Neither
      // gets deleted, so the documents alone can never resolve this.
      await seedFacility(tx, geo, sharedCpf);
      const chosen = await seedFacility(tx, geo, sharedCpf);

      await recordEmultecSkip(
        {
          idAvulsa,
          detail: {
            reason: "facility_ambiguous",
            blocker: "DOCUMENT",
            idClienteEmultec: idCliente,
            blockerDocuments: [sharedCpf],
          },
        },
        tx
      );

      // Both facilities carry the document, so a naive "does a facility have
      // this document?" check would surface this order on every tick, fetch it
      // from Emultec, watch it skip as ambiguous again, and repeat forever.
      expect(await listUnblockedEmultecOrderIds({ limit: 50 }, tx)).not.toContain(
        idAvulsa
      );

      // Recording the link is the only thing that makes the import succeed.
      await tx.insert(facilityEmultecClients).values({
        idClienteEmultec: idCliente,
        facilityId: chosen,
        source: "MANUAL",
      });

      expect(await listUnblockedEmultecOrderIds({ limit: 50 }, tx)).toContain(
        idAvulsa
      );
    });
  });

  test("SELLER clears when a user takes the vendedor id", async () => {
    await withRollback(async (tx) => {
      const idVendedor = 7_000_000 + Math.floor(Math.random() * 100_000);
      const idAvulsa = avulsaId();

      await recordEmultecSkip(
        {
          idAvulsa,
          detail: {
            reason: "seller_unmapped",
            blocker: "SELLER",
            idVendedorEmultec: idVendedor,
          },
        },
        tx
      );

      expect(await listUnblockedEmultecOrderIds({ limit: 50 }, tx)).not.toContain(
        idAvulsa
      );

      // `roles` is seeded by migrations in some databases and not others, so
      // take whatever is there and only insert when the table is empty.
      const [existingRole] = await tx.select({ id: roles.id }).from(roles).limit(1);
      const role =
        existingRole ??
        (
          await tx
            .insert(roles)
            .values({ name: `T-Role-${idVendedor}` })
            .returning({ id: roles.id })
        )[0];
      await tx.insert(users).values({
        username: `t-rep-${idVendedor}`,
        email: `t-rep-${idVendedor}@example.test`,
        passwordHash: "x",
        roleId: role!.id,
        idVendedorEmultec: idVendedor,
      });

      expect(await listUnblockedEmultecOrderIds({ limit: 50 }, tx)).toContain(
        idAvulsa
      );
    });
  });

  test("PRODUCTS clears on the first mapped id, not the whole set", async () => {
    await withRollback(async (tx) => {
      const base = 8_000_000 + Math.floor(Math.random() * 100_000);
      const idAvulsa = avulsaId();

      await recordEmultecSkip(
        {
          idAvulsa,
          detail: {
            reason: "products_unmapped",
            blocker: "PRODUCTS",
            blockerProductIds: [base, base + 1, base + 2],
          },
        },
        tx
      );

      expect(await listUnblockedEmultecOrderIds({ limit: 50 }, tx)).not.toContain(
        idAvulsa
      );

      // The importer writes the order as soon as one line maps, so the queue
      // must surface it on one — waiting for all three would strand it.
      await tx.insert(products).values({
        name: `T-Product-${base + 1}`,
        manufacturer: "T-Manufacturer",
        countryOfOrigin: "BR",
        price17: "1.00",
        price18: "1.00",
        price20: "1.00",
        idProdutoEmultec: base + 1,
      });

      expect(await listUnblockedEmultecOrderIds({ limit: 50 }, tx)).toContain(
        idAvulsa
      );
    });
  });

  test("NONE is never re-checked", async () => {
    await withRollback(async (tx) => {
      const idAvulsa = avulsaId();

      await recordEmultecSkip(
        {
          idAvulsa,
          detail: {
            reason: "facility_no_document",
            blocker: "NONE",
            idClienteEmultec: 9_999,
          },
        },
        tx
      );

      // Nothing we can enter clears it, so it must never cost an Emultec fetch.
      expect(await listUnblockedEmultecOrderIds({ limit: 50 }, tx)).not.toContain(
        idAvulsa
      );
    });
  });

  test("a resolved row is never re-surfaced", async () => {
    await withRollback(async (tx) => {
      const geo = await seedGeo(tx);
      const document = cnpjDigits();
      const idAvulsa = avulsaId();

      await seedFacility(tx, geo, document);
      await recordEmultecSkip(
        {
          idAvulsa,
          detail: {
            reason: "facility_no_match",
            blocker: "DOCUMENT",
            blockerDocuments: [document],
          },
        },
        tx
      );
      await resolveEmultecSkip(idAvulsa, tx);

      // Its blocker still "looks" cleared; only `resolved_at` keeps it out, and
      // without that every tick would re-import every order forever.
      expect(await listUnblockedEmultecOrderIds({ limit: 50 }, tx)).not.toContain(
        idAvulsa
      );
    });
  });
});
