import { describe, expect, test } from "bun:test";
import {
  businessVerticals,
  conformityRequirements,
  facilities,
  facilityVerticalProfiles,
  municipalities,
  states,
  submissionDocuments,
} from "@atlasmed/database";
import { sql } from "drizzle-orm";
import { isDatabaseReachable, withRollback } from "../../../../../test-utils/db-harness";

/**
 * The shape ADR 0007 and migration `0084` actually produced, against a real
 * Postgres.
 *
 * Two claims are worth proving rather than assuming, because both are silent
 * when wrong:
 *
 * 1. **A document needs no package.** `facility_id` is the parent now. If the
 *    column or its FK were missing the insert would fail; if the old
 *    `submission_id` NOT NULL survived, it would fail too.
 * 2. **`facility_vertical_profile_id` is nullable.** That null is what "one
 *    Cartão CNPJ counts for every linha" means. A NOT NULL here would force a
 *    profile per shared document and quietly duplicate it per linha.
 *
 * Plus the index that replaced the partial-unique DRAFT index that wedged
 * clinics (D-16): uniqueness is per version, so re-uploading over a reviewed
 * document opens v2 instead of colliding.
 */
const dbUp = await isDatabaseReachable();

async function seedFacility(tx: Parameters<Parameters<typeof withRollback>[0]>[0]) {
  const [state] = await tx
    .insert(states)
    .values({ name: "T-DocKeys", ibgeId: "97", abbreviation: "TK" })
    .returning({ id: states.id });
  const [municipality] = await tx
    .insert(municipalities)
    .values({ stateId: state!.id, name: "T-DocKeys-City", ibgeId: "9799999" })
    .returning({ id: municipalities.id });
  const [facility] = await tx
    .insert(facilities)
    .values({
      // Spec 0015: every facility carries the CNES establishment it came from.
      cnesCode: crypto.randomUUID(),
      displayName: "CLINICA DOC KEYS",
      legalDocumentType: "CNPJ",
      stateId: state!.id,
      municipalityId: municipality!.id,
      // Spec 0009 R5: every clinic has a position.
      location: sql`ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326)`,
    })
    .returning({ id: facilities.id });
  return facility!.id;
}

describe.skipIf(!dbUp)("cadastro document keys (database)", () => {
  test("a document belongs to a facility, with an optional linha", async () => {
    await withRollback(async (tx) => {
      const facilityId = await seedFacility(tx);

      const [vertical] = await tx
        .insert(businessVerticals)
        .values({ code: "T-DOCKEYS", name: "T-DOCKEYS" })
        .returning({ id: businessVerticals.id });
      const [profile] = await tx
        .insert(facilityVerticalProfiles)
        .values({ facilityId, verticalId: vertical!.id })
        .returning({ id: facilityVerticalProfiles.id });

      const [shared] = await tx
        .insert(conformityRequirements)
        .values({ slug: "t-dockeys-cnpj", name: "Cartão CNPJ", verticalId: null })
        .returning({ id: conformityRequirements.id });
      const [perLinha] = await tx
        .insert(conformityRequirements)
        .values({
          slug: "t-dockeys-linha",
          name: "Documento da linha",
          verticalId: vertical!.id,
        })
        .returning({ id: conformityRequirements.id });

      const rows = await tx
        .insert(submissionDocuments)
        .values([
          // Facility-scoped: no profile, counts for every linha.
          {
            facilityId,
            facilityVerticalProfileId: null,
            requirementId: shared!.id,
            title: "Cartão CNPJ",
          },
          {
            facilityId,
            facilityVerticalProfileId: profile!.id,
            requirementId: perLinha!.id,
            title: "Documento da linha",
          },
        ])
        .returning({
          id: submissionDocuments.id,
          facilityId: submissionDocuments.facilityId,
          profileId: submissionDocuments.facilityVerticalProfileId,
          version: submissionDocuments.version,
          status: submissionDocuments.status,
        });

      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.facilityId === facilityId)).toBe(true);
      expect(rows.map((r) => r.profileId)).toEqual([null, profile!.id]);
      // A fresh document starts at v1, in DRAFT.
      expect(rows.every((r) => r.version === 1 && r.status === "DRAFT")).toBe(true);
    });
  });

  test("versions stack per requirement; a duplicate version is rejected", async () => {
    await withRollback(async (tx) => {
      const facilityId = await seedFacility(tx);
      const [requirement] = await tx
        .insert(conformityRequirements)
        .values({ slug: "t-dockeys-versions", name: "Identidade", verticalId: null })
        .returning({ id: conformityRequirements.id });

      // A rejected v1, then a correction as v2 — the flow that used to collide
      // with the "one DRAFT per facility" partial index and wedge the clinic.
      await tx.insert(submissionDocuments).values({
        facilityId,
        facilityVerticalProfileId: null,
        requirementId: requirement!.id,
        title: "Identidade",
        status: "REJECTED",
        version: 1,
      });
      const [second] = await tx
        .insert(submissionDocuments)
        .values({
          facilityId,
          facilityVerticalProfileId: null,
          requirementId: requirement!.id,
          title: "Identidade",
          version: 2,
        })
        .returning({ id: submissionDocuments.id });
      expect(second!.id).toBeGreaterThan(0);

      // The same version twice is the one thing the index forbids. Asserted on
      // the SQLSTATE rather than the message: drizzle rewraps the driver error
      // as "Failed query: …", so matching on text would pass for any failure.
      // This must stay the last statement — the failed insert aborts the
      // surrounding transaction.
      let code: string | undefined;
      try {
        await tx.insert(submissionDocuments).values({
          facilityId,
          facilityVerticalProfileId: null,
          requirementId: requirement!.id,
          title: "Identidade duplicada",
          version: 2,
        });
      } catch (error) {
        code = (error as { cause?: { code?: string } }).cause?.code;
      }
      // 23505 = unique_violation.
      expect(code).toBe("23505");
    });
  });
});
