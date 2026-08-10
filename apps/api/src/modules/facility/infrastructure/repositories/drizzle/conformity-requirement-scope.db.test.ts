import { describe, expect, test } from "bun:test";
import { businessVerticals, conformityRequirements } from "@atlasmed/database";
import { isDatabaseReachable, withRollback } from "../../../../../test-utils/db-harness";
import { DrizzleConformityRepository } from "./drizzle-conformity.repository";

/**
 * Requirement scoping, against a real database.
 *
 * ADR 0007: `conformity_requirements` has two nullable scope columns —
 * `vertical_id` and `applies_to_legal_document_type` — and a null in either
 * means "applies to everyone". They used to disagree: a null vertical was
 * included, a null legal type excluded. Getting this wrong is invisible, it
 * just shows a rep the wrong list, so it is asserted rather than assumed.
 *
 * The four combinations below are the whole rule.
 */
const dbUp = await isDatabaseReachable();

describe.skipIf(!dbUp)("conformity requirement scoping (database)", () => {
  test("null scope columns mean applies-to-all, in both directions", async () => {
    await withRollback(async (tx) => {
      const [orto] = await tx
        .insert(businessVerticals)
        .values({ code: "T-SCOPE-ORTO", name: "T-SCOPE-ORTO" })
        .returning({ id: businessVerticals.id });
      const [derma] = await tx
        .insert(businessVerticals)
        .values({ code: "T-SCOPE-DERMA", name: "T-SCOPE-DERMA" })
        .returning({ id: businessVerticals.id });

      const slugs = {
        everyone: "t-scope-everyone",
        cnpjOnly: "t-scope-cnpj-only",
        ortoOnly: "t-scope-orto-only",
        dermaOnly: "t-scope-derma-only",
      };

      await tx.insert(conformityRequirements).values([
        // The Cartão CNPJ case: every linha, companies only.
        {
          slug: slugs.cnpjOnly,
          name: "CNPJ only",
          verticalId: null,
          appliesToLegalDocumentType: "CNPJ",
        },
        // Unscoped entirely — the case that used to be silently excluded.
        {
          slug: slugs.everyone,
          name: "Everyone",
          verticalId: null,
          appliesToLegalDocumentType: null,
        },
        {
          slug: slugs.ortoOnly,
          name: "Orto only",
          verticalId: orto!.id,
          appliesToLegalDocumentType: null,
        },
        {
          slug: slugs.dermaOnly,
          name: "Derma only",
          verticalId: derma!.id,
          appliesToLegalDocumentType: null,
        },
      ]);

      const repository = new DrizzleConformityRepository(tx as never);

      const forOrtoCnpj = (
        await repository.findActiveRequirements({
          legalDocumentType: "CNPJ",
          verticalId: orto!.id,
        })
      )
        .map((r) => r.slug)
        .filter((slug) => slug.startsWith("t-scope-"));

      // Its own linha, plus both flavours of unscoped. Never another linha's.
      expect(forOrtoCnpj.sort()).toEqual(
        [slugs.cnpjOnly, slugs.everyone, slugs.ortoOnly].sort()
      );
      expect(forOrtoCnpj).not.toContain(slugs.dermaOnly);

      const forOrtoCpf = (
        await repository.findActiveRequirements({
          legalDocumentType: "CPF",
          verticalId: orto!.id,
        })
      )
        .map((r) => r.slug)
        .filter((slug) => slug.startsWith("t-scope-"));

      // A CPF clinic must not be asked for the CNPJ-only document.
      expect(forOrtoCpf.sort()).toEqual([slugs.everyone, slugs.ortoOnly].sort());
      expect(forOrtoCpf).not.toContain(slugs.cnpjOnly);
    });
  });

  test("the admin catalogue is unscoped — no params, no filtering", async () => {
    await withRollback(async (tx) => {
      const [vertical] = await tx
        .insert(businessVerticals)
        .values({ code: "T-SCOPE-ADMIN", name: "T-SCOPE-ADMIN" })
        .returning({ id: businessVerticals.id });

      await tx.insert(conformityRequirements).values({
        slug: "t-scope-admin-only",
        name: "Admin visible",
        verticalId: vertical!.id,
        appliesToLegalDocumentType: "CNPJ",
      });

      const all = (await new DrizzleConformityRepository(tx as never).findActiveRequirements())
        .map((r) => r.slug)
        .filter((slug) => slug.startsWith("t-scope-"));

      expect(all).toContain("t-scope-admin-only");
    });
  });
});
