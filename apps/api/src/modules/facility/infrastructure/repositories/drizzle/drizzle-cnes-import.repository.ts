import { sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";

/**
 * Creating one of our people from a registry professional (spec 0012 §6).
 *
 * Identity is copied from the registry, never taken from the client: the council
 * registration is what makes a doctor resolvable, and letting a rep type it
 * would put the one field that must match CNES under the control of whoever is
 * in a hurry.
 */

export interface RegistryProfessional {
  cnesId: string;
  fullName: string;
  socialName: string | null;
  /** Already one of ours — the loader's bridge, or an earlier import. */
  atlasmedId: number | null;
  /** True when CNES places them at the facility being imported into. */
  atThisFacility: boolean;
  registrations: RegistryRegistration[];
  /** CBOs CNES records for them at this clinic. */
  occupations: string[];
}

export interface RegistryRegistration {
  councilId: number;
  councilAbbreviation: string;
  stateCode: string;
  registrationNumber: string;
  /** The person on our side already holding it, if anyone does. */
  heldByPersonId: number | null;
  heldByName: string | null;
}

export class DrizzleCnesImportRepository {
  /**
   * Everything the import needs about one registry professional, read in one
   * pass so the decision is made against a single snapshot.
   */
  async findProfessional(input: {
    professionalCnesId: string;
    facilityId: number;
  }): Promise<RegistryProfessional | null> {
    const [row] = (await db.execute(sql`
      select
        rp.cnes_id      as cnes_id,
        rp.full_name    as full_name,
        rp.social_name  as social_name,
        rp.atlasmed_id  as atlasmed_id,
        exists (
          select 1
            from registry.facility_professionals fp
            join registry.facilities rf on rf.cnes_id = fp.facility_cnes_id
           where fp.professional_cnes_id = rp.cnes_id
             and rf.atlasmed_id = ${input.facilityId}
        )               as at_this_facility
      from registry.professionals rp
      where rp.cnes_id = ${input.professionalCnesId}
    `)) as unknown as {
      cnes_id: string;
      full_name: string;
      social_name: string | null;
      atlasmed_id: number | string | null;
      at_this_facility: boolean;
    }[];

    if (!row) return null;

    /*
     * Council mapping is by abbreviation, the same correspondence the loader
     * bridges on. A registry council with no counterpart on our side yields no
     * row, and the import then refuses rather than inventing a council.
     */
    const registrations = (await db.execute(sql`
      select
        c.id            as council_id,
        c.abbreviation  as council_abbreviation,
        rr.state_code   as state_code,
        rr.registration_number as registration_number,
        held.person_id  as held_by_person_id,
        held.full_name  as held_by_name
      from registry.professional_registrations rr
      join registry.professional_councils rc
        on rc.cnes_id = rr.council_cnes_id
      join person_professional_registration_councils c
        on c.abbreviation = rc.abbreviation
      left join lateral (
        select ppr.person_id, p.first_name || ' ' || p.last_name as full_name
          from person_professional_registrations ppr
          join persons p on p.id = ppr.person_id
         where ppr.council_id = c.id
           and ppr.state_code = rr.state_code
           and ppr.registration_number = rr.registration_number
         limit 1
      ) held on true
      where rr.professional_cnes_id = ${input.professionalCnesId}
      order by c.abbreviation, rr.state_code
    `)) as unknown as {
      council_id: number | string;
      council_abbreviation: string;
      state_code: string;
      registration_number: string;
      held_by_person_id: number | string | null;
      held_by_name: string | null;
    }[];

    const occupations = (await db.execute(sql`
      select distinct ro.name as name
        from registry.facility_professional_occupations fo
        join registry.facilities rf on rf.cnes_id = fo.facility_cnes_id
        join registry.occupations ro on ro.cnes_id = fo.occupation_cnes_id
       where fo.professional_cnes_id = ${input.professionalCnesId}
         and rf.atlasmed_id = ${input.facilityId}
    `)) as unknown as { name: string }[];

    return {
      cnesId: row.cnes_id,
      fullName: row.full_name,
      socialName: row.social_name,
      // bigint arrives as a string from this driver.
      atlasmedId: row.atlasmed_id == null ? null : Number(row.atlasmed_id),
      atThisFacility: row.at_this_facility === true,
      registrations: registrations.map((r) => ({
        councilId: Number(r.council_id),
        councilAbbreviation: r.council_abbreviation,
        stateCode: r.state_code,
        registrationNumber: r.registration_number,
        heldByPersonId:
          r.held_by_person_id == null ? null : Number(r.held_by_person_id),
        heldByName: r.held_by_name,
      })),
      occupations: occupations.map((o) => o.name),
    };
  }

  /**
   * Creates the person and everything that makes them the registry professional,
   * in one transaction.
   *
   * All of it or none of it. A person written without their registration is a
   * person no later import can recognise — the next month's export would offer
   * to create them again, and only the unique on (council, UF, number) would
   * stop it, by then as an error rather than a match.
   */
  async createFromRegistry(input: {
    professional: RegistryProfessional;
    firstName: string;
    lastName: string;
    socialName: string | null;
    cpf: string | null;
    email: string | null;
    mobilePhone: string | null;
  }): Promise<number> {
    return db.transaction(async (tx) => {
      const [person] = (await tx.execute(sql`
        insert into persons (first_name, last_name, social_name, cpf, email, mobile_phone)
        values (
          ${input.firstName}, ${input.lastName}, ${input.socialName},
          ${input.cpf}, ${input.email}, ${input.mobilePhone}
        )
        returning id
      `)) as unknown as { id: number | string }[];
      const personId = Number(person!.id);

      /*
       * The SUS id goes on the profile as well as the bridge. Both are unique
       * and both resolve this person, and writing only one would leave the
       * other route to invent a second answer later.
       */
      await tx.execute(sql`
        insert into person_healthcare_profiles (person_id, cnes_professional_id)
        values (${personId}, ${input.professional.cnesId})
      `);

      for (const registration of input.professional.registrations) {
        await tx.execute(sql`
          insert into person_professional_registrations
            (person_id, council_id, state_code, registration_number, is_primary)
          values (
            ${personId}, ${registration.councilId}, ${registration.stateCode},
            ${registration.registrationNumber},
            ${registration === input.professional.registrations[0]}
          )
        `);
      }

      await tx.execute(sql`
        update registry.professionals set atlasmed_id = ${personId}, updated_at = now()
         where cnes_id = ${input.professional.cnesId}
      `);

      return personId;
    });
  }
}
