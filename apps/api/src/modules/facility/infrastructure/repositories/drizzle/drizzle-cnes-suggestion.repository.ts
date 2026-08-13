import { sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";

/**
 * Professionals CNES associates with a clinic that already exist in our
 * database, minus the ones a user has already linked (spec 0012 §5).
 *
 * **Read-only, and it stays in the facility module.** ADR 0006 excludes a
 * `/registry/*` API module; the registry is reference data serving a facility
 * question, not a resource of its own.
 *
 * **A join, never a stored link.** The correspondence is evaluated per query
 * (ADR 0006), so a registry reload changes the answer with no migration and no
 * relink step. The key is one column — `registry.professionals.cnes_id` is
 * `CO_PROFISSIONAL_SUS`, which we already store as
 * `person_healthcare_profiles.cnes_professional_id`; both sides are unique and
 * indexed, measured at 100 % coverage against the real export (ADR 0009).
 */

export interface CnesSuggestion {
  personId: number;
  firstName: string;
  lastName: string;
  socialName: string | null;
  /** CBOs CNES records for this person **at this clinic**, not globally. */
  occupations: string[];
  registrationNumber: string | null;
  registrationStateCode: string | null;
  registrationCouncil: string | null;
  /**
   * Already linked here as a clinician.
   *
   * Returned rather than filtered out: the CNES view is scoped to this
   * snapshot, so "of the people CNES places at this clinic, these you already
   * have" is a different and more useful statement than our whole roster. AC 2
   * still holds — they are labelled, and the client keeps them out of the
   * suggestion section.
   */
  alreadyLinked: boolean;
}

export interface CnesSuggestionContext {
  /** The clinic carries a `cnes_code`, so the join has a left-hand side. */
  facilityHasCnesCode: boolean;
  /** That code resolves to a loaded registry facility. */
  facilityInRegistry: boolean;
  /**
   * The registry holds anything at all.
   *
   * Answered from `registry.facilities` rather than from the run ledger. "Is
   * there data" is a question about the data: a registry loaded by script — or
   * by a run whose ledger row was pruned — is still loaded, and reporting it as
   * empty told users nothing had been imported while 25 217 vínculos sat in the
   * table.
   */
  registryHasData: boolean;
  /**
   * Competence of the most recent successful load, e.g. `2026-05`. Null when no
   * run recorded one, which is a missing *label*, not missing data.
   */
  loadedReference: string | null;
  loadedAt: Date | null;
}

export class DrizzleCnesSuggestionRepository {
  /**
   * Why context is separate from the list: an empty list has three different
   * meanings — the clinic has no CNES code, the registry was never loaded, or
   * CNES genuinely knows nobody here who is not already linked. Collapsing them
   * into "no results" is what makes a working feature look broken.
   */
  async context(facilityId: number): Promise<CnesSuggestionContext> {
    const rows = (await db.execute(sql`
      select
        (f.cnes_code is not null)                          as facility_has_cnes_code,
        (rf.cnes_id is not null)                           as facility_in_registry,
        (exists (select 1 from registry.facilities))       as registry_has_data,
        run.reference_year                                 as reference_year,
        run.reference_month                                as reference_month,
        run.promoted_at                                    as promoted_at
      from facilities f
      left join registry.facilities rf on rf.atlasmed_id = f.id
      left join lateral (
        select reference_year, reference_month, promoted_at
          from ingestion.cnes_runs
         where status = 'COMPLETED' and promoted_at is not null
         order by promoted_at desc
         limit 1
      ) run on true
      where f.id = ${facilityId}
    `)) as unknown as {
      facility_has_cnes_code: boolean;
      facility_in_registry: boolean;
      registry_has_data: boolean;
      reference_year: number | null;
      reference_month: number | null;
      promoted_at: Date | string | null;
    }[];

    const row = rows[0];
    if (!row) {
      return {
        facilityHasCnesCode: false,
        facilityInRegistry: false,
        registryHasData: false,
        loadedReference: null,
        loadedAt: null,
      };
    }

    const reference =
      row.reference_year != null && row.reference_month != null
        ? `${row.reference_year}-${String(row.reference_month).padStart(2, "0")}`
        : null;

    return {
      facilityHasCnesCode: row.facility_has_cnes_code === true,
      facilityInRegistry: row.facility_in_registry === true,
      registryHasData: row.registry_has_data === true,
      loadedReference: reference,
      loadedAt: row.promoted_at ? new Date(row.promoted_at) : null,
    };
  }

  async list(input: {
    facilityId: number;
    limit: number;
  }): Promise<CnesSuggestion[]> {
    const rows = (await db.execute(sql`
      select
        p.id                               as person_id,
        p.first_name                       as first_name,
        p.last_name                        as last_name,
        p.social_name                      as social_name,
        coalesce(
          array_agg(distinct ro.name) filter (where ro.name is not null),
          '{}'
        )                                  as occupations,
        max(rr.registration_number)        as registration_number,
        max(rr.state_code)                 as registration_state_code,
        max(rc.abbreviation)               as registration_council,
        bool_or(pf.id is not null)         as already_linked
      from registry.facilities rf
      join registry.facility_professionals fp
        on fp.facility_cnes_id = rf.cnes_id
      join registry.professionals rp
        on rp.cnes_id = fp.professional_cnes_id
      /*
       * Two routes to the same person, and the row appears if either resolves.
       *
       * atlasmed_id is the bridge the loader writes by matching the council
       * registration; cnes_professional_id is CNES's own identifier, present
       * only on people an old backfill stamped. A doctor a rep entered by hand
       * has a CRM and no SUS id, so joining on the SUS id alone would report
       * them as somebody CNES knows and we do not -- while the bridge, written
       * that same month, already says who they are.
       *
       * The bridge wins where both exist. It is the one a human can correct.
       */
      left join person_healthcare_profiles hp
        on hp.cnes_professional_id = rp.cnes_id
      join persons p
        on p.id = coalesce(rp.atlasmed_id, hp.person_id)
      left join registry.facility_professional_occupations fo
        on fo.facility_cnes_id = fp.facility_cnes_id
       and fo.professional_cnes_id = fp.professional_cnes_id
      left join registry.occupations ro
        on ro.cnes_id = fo.occupation_cnes_id
      left join registry.professional_registrations rr
        on rr.professional_cnes_id = rp.cnes_id
      left join registry.professional_councils rc
        on rc.cnes_id = rr.council_cnes_id
      -- Left-joined rather than used in a NOT EXISTS, so an existing link
      -- labels the row instead of removing it. The classification is what makes
      -- it a *clinician* link: 211 active links are administrative contacts, and
      -- treating those as "already associated" would hide a doctor from both
      -- sections of the sheet at once.
      left join person_facilities pf
        on pf.person_id = p.id
       and pf.facility_id = ${input.facilityId}
       and pf.ended_at is null
       and exists (
         select 1
           from person_facility_classification_assignments pfca
           join person_facility_classifications pfc
             on pfc.id = pfca.classification_id
          where pfca.person_facility_id = pf.id
            and pfc.code = 'HEALTHCARE_PROFESSIONAL'
       )
      where rf.atlasmed_id = ${input.facilityId}
        and p.deleted_at is null
      group by p.id, p.first_name, p.last_name, p.social_name
      -- Unlinked first: the suggestions are the actionable half, and the linked
      -- rows are context for how much of this clinic CNES already agrees with.
      order by bool_or(pf.id is not null), p.first_name, p.last_name
      limit ${input.limit}
    `)) as unknown as {
      person_id: number;
      first_name: string;
      last_name: string;
      social_name: string | null;
      occupations: string[] | null;
      registration_number: string | null;
      registration_state_code: string | null;
      registration_council: string | null;
      already_linked: boolean | null;
    }[];

    return rows.map((row) => ({
      // `persons.id` is bigint, and the driver hands those back as strings to
      // avoid precision loss. Passing it through gave a payload whose personId
      // was `"410"` while this type said `number` — the API looked correct in
      // every test and the client threw on the cast, which surfaced as "could
      // not consult CNES" rather than as a type error.
      personId: Number(row.person_id),
      firstName: row.first_name,
      lastName: row.last_name,
      socialName: row.social_name,
      occupations: row.occupations ?? [],
      registrationNumber: row.registration_number,
      registrationStateCode: row.registration_state_code,
      registrationCouncil: row.registration_council,
      alreadyLinked: row.already_linked === true,
    }));
  }
}
