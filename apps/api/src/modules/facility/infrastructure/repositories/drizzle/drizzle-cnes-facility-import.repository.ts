import { sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Reads and writes for importing a CNES establishment into `public.facilities`
 * (spec 0015 §6).
 *
 * Kept apart from `DrizzleFacilityRepository` because the two answer different
 * questions. That one is about clinics we operate; this one is about the
 * national registry and the single act of promoting one row out of it. Its
 * queries cross into `registry.*`, where there are deliberately no foreign keys
 * (spec 0012: opposite lifecycles), so they are written as raw SQL rather than
 * pretending a relation exists.
 */

/** What the registry knows, plus whether we already hold it. */
export interface RegistryEstablishment {
  cnesCode: string;
  legalName: string | null;
  tradeName: string | null;
  taxIdCnpj: string | null;
  taxIdCpf: string | null;
  legalPersonType: string | null;
  maintainerTaxId: string | null;
  streetAddress: string | null;
  streetNumber: string | null;
  addressComplement: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  phoneNumber: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  unitTypeCode: string | null;
  unitSubtypeCode: string | null;
  /** Null when CNES ships a code no catalogue defines — `16`, or junk (§4.3). */
  unitTypeId: number | null;
  unitSubtypeId: number | null;
  /** Set = this kind of establishment is importable at all (§3.2). */
  unitTypeImportable: boolean;
  deactivationReasonCode: string | null;
  municipalityCnesId: string | null;
  municipalityName: string | null;
  /** Null when the município exists in the registry but not in `public` (§4.5). */
  municipalityId: number | null;
  stateAbbreviation: string | null;
  stateId: number | null;
  /** Already ours. The import then only adds a vertical profile (§6.1). */
  atlasmedId: number | null;
  /** Verticals whose active profile already covers the linked facility. */
  verticalIds: number[];
}

interface EstablishmentRow {
  cnes_id: string;
  legal_name: string | null;
  trade_name: string | null;
  tax_id_cnpj: string | null;
  tax_id_cpf: string | null;
  legal_person_type: string | null;
  maintainer_tax_id: string | null;
  street_address: string | null;
  street_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  phone_number: string | null;
  email: string | null;
  latitude: string | null;
  longitude: string | null;
  unit_type_code: string | null;
  unit_subtype_code: string | null;
  unit_type_id: number | null;
  unit_subtype_id: number | null;
  unit_type_importable: boolean;
  deactivation_reason_code: string | null;
  municipality_cnes_id: string | null;
  municipality_name: string | null;
  municipality_id: number | null;
  state_abbreviation: string | null;
  state_id: number | null;
  atlasmed_id: number | null;
  vertical_ids: number[] | null;
}

export class DrizzleCnesFacilityImportRepository {
  async findEstablishment(cnesCode: string): Promise<RegistryEstablishment | null> {
    const rows = (await db.execute(sql`
      select rf.cnes_id, rf.legal_name, rf.trade_name, rf.tax_id_cnpj, rf.tax_id_cpf,
             rf.legal_person_type, rf.maintainer_tax_id,
             rf.street_address, rf.street_number, rf.address_complement,
             rf.neighborhood, rf.postal_code, rf.phone_number, rf.email,
             rf.latitude::text as latitude, rf.longitude::text as longitude,
             rf.unit_type_code, rf.unit_subtype_code,
             rut.atlasmed_id as unit_type_id,
             rus.atlasmed_id as unit_subtype_id,
             (rut.atlasmed_id is not null) as unit_type_importable,
             rf.deactivation_reason_code,
             rf.municipality_cnes_id, rm.name as municipality_name,
             rm.atlasmed_id as municipality_id,
             rs.cnes_id as state_abbreviation, rs.atlasmed_id as state_id,
             rf.atlasmed_id,
             (
               select coalesce(array_agg(p.vertical_id order by p.vertical_id), '{}')
                 from facility_vertical_profiles p
                where p.facility_id = rf.atlasmed_id and p.is_active
             ) as vertical_ids
        from registry.facilities rf
        left join registry.unit_types rut on rut.cnes_id = rf.unit_type_code
        left join registry.unit_subtypes rus
               on rus.unit_type_cnes_id = rf.unit_type_code
              and rus.cnes_id = rf.unit_subtype_code
        left join registry.municipalities rm on rm.cnes_id = rf.municipality_cnes_id
        left join registry.states rs on rs.cnes_id = rm.state_cnes_id
       where rf.cnes_id = ${cnesCode}
       limit 1
    `)) as unknown as EstablishmentRow[];

    const row = rows[0];
    if (!row) return null;

    return {
      cnesCode: row.cnes_id,
      legalName: row.legal_name,
      tradeName: row.trade_name,
      taxIdCnpj: row.tax_id_cnpj,
      taxIdCpf: row.tax_id_cpf,
      legalPersonType: row.legal_person_type,
      maintainerTaxId: row.maintainer_tax_id,
      streetAddress: row.street_address,
      streetNumber: row.street_number,
      addressComplement: row.address_complement,
      neighborhood: row.neighborhood,
      postalCode: row.postal_code,
      phoneNumber: row.phone_number,
      email: row.email,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      unitTypeCode: row.unit_type_code,
      unitSubtypeCode: row.unit_subtype_code,
      unitTypeId: row.unit_type_id,
      unitSubtypeId: row.unit_subtype_id,
      unitTypeImportable: row.unit_type_importable === true,
      deactivationReasonCode: row.deactivation_reason_code,
      municipalityCnesId: row.municipality_cnes_id,
      municipalityName: row.municipality_name,
      municipalityId: row.municipality_id,
      stateAbbreviation: row.state_abbreviation,
      stateId: row.state_id,
      atlasmedId: row.atlasmed_id === null ? null : Number(row.atlasmed_id),
      verticalIds: (row.vertical_ids ?? []).map(Number),
    };
  }

  /**
   * The facility that already holds this CNPJ, if any.
   *
   * A hit is a genuine conflict, not a duplicate to resolve: two establishments
   * claiming one legal entity. Of 276 148 distinct CNPJs on active
   * establishments, 276 047 name exactly one site, so this is rare and worth
   * reporting rather than guessing at.
   */
  async findActiveFacilityByCnpj(
    legalDocument: string
  ): Promise<{ id: number; name: string; cnesCode: string } | null> {
    const rows = (await db.execute(sql`
      select id, name, cnes_code
        from facilities
       where deactivated_at is null
         and legal_document_type = 'CNPJ'
         and legal_document = ${legalDocument}
       limit 1
    `)) as unknown as { id: number; name: string; cnes_code: string }[];
    const row = rows[0];
    return row
      ? { id: Number(row.id), name: row.name, cnesCode: row.cnes_code }
      : null;
  }

  /** Verticals that exist and are usable — the set an admin may choose from. */
  async listActiveVerticalIds(): Promise<number[]> {
    const rows = (await db.execute(sql`
      select id from business_verticals order by id
    `)) as unknown as { id: number }[];
    return rows.map((r) => r.id);
  }

  /**
   * Create the município from the registry when `public` does not hold it.
   *
   * The registry carries 5 604 municípios against public's 5 571, so 33 exist in
   * CNES and not here. A real clinic in a real município is not a data error to
   * reject (§4.5), and the alternative — refusing the import — would strand
   * whole municipalities with no path in.
   *
   * Returns null when even the registry cannot place it, which leaves the
   * decision to the caller rather than inventing geography.
   */
  async ensureMunicipality(
    municipalityCnesId: string
  ): Promise<{ municipalityId: number; stateId: number } | null> {
    const rows = (await db.execute(sql`
      with registry_row as (
        select rm.cnes_id, rm.name, rs.atlasmed_id as state_id
          from registry.municipalities rm
          join registry.states rs on rs.cnes_id = rm.state_cnes_id
         where rm.cnes_id = ${municipalityCnesId}
      ),
      inserted as (
        insert into municipalities (name, ibge_id, cnes_code, state_id)
        select r.name, r.cnes_id, r.cnes_id, r.state_id
          from registry_row r
         where r.state_id is not null
           and not exists (
             select 1 from municipalities m where m.cnes_code = r.cnes_id
           )
        returning id, state_id
      )
      select id, state_id from inserted
      union all
      select m.id, m.state_id from municipalities m
        join registry_row r on r.cnes_id = m.cnes_code
       limit 1
    `)) as unknown as { id: number; state_id: number }[];

    const row = rows[0];
    if (!row) return null;

    /*
     * Bridge the registry row back, so the next import resolves it directly
     * rather than running this again.
     */
    await db.execute(sql`
      update registry.municipalities
         set atlasmed_id = ${row.id}, updated_at = now()
       where cnes_id = ${municipalityCnesId} and atlasmed_id is null
    `);

    return { municipalityId: Number(row.id), stateId: Number(row.state_id) };
  }

  /**
   * Promote one establishment: facility, its vertical profiles, and the bridge,
   * in a single transaction.
   *
   * All three or none. A facility with no profile is invisible to everybody
   * (invariant 2), and a facility with no bridge is one the next import would
   * offer again — so a partial write here is worse than a failed one.
   */
  async createFromRegistry(input: {
    cnesCode: string;
    name: string;
    legalDocumentType: "CNPJ" | "CPF";
    legalDocument: string | null;
    streetAddress: string | null;
    streetNumber: string | null;
    addressComplement: string | null;
    neighborhood: string | null;
    postalCode: string | null;
    phoneNumber: string | null;
    email: string | null;
    stateId: number;
    municipalityId: number;
    lat: number;
    lng: number;
    unitTypeId: number | null;
    unitSubtypeId: number | null;
    verticalIds: number[];
  }): Promise<{ facilityId: number }> {
    return db.transaction(async (tx: Tx) => {
      const inserted = (await tx.execute(sql`
        insert into facilities (
          name, legal_name, trade_name, cnes_code,
          legal_document_type, legal_document,
          street_address, street_number, address_complement, neighborhood,
          postal_code, phone_number, email,
          state_id, municipality_id, location, unit_type_id, unit_subtype_id
        ) values (
          ${input.name}, ${input.name}, ${input.name}, ${input.cnesCode},
          ${input.legalDocumentType}, ${input.legalDocument},
          ${input.streetAddress}, ${input.streetNumber}, ${input.addressComplement},
          ${input.neighborhood}, ${input.postalCode}, ${input.phoneNumber}, ${input.email},
          ${input.stateId}, ${input.municipalityId},
          ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326),
          ${input.unitTypeId}, ${input.unitSubtypeId}
        )
        returning id
      `)) as unknown as { id: number }[];

      /*
       * Coerced, not cast. `facilities.id` is `bigint`, and the driver hands
       * those back as strings — so an uncoerced value is typed `number`, is not
       * one, and every `===` downstream quietly fails.
       */
      const rawId = inserted[0]?.id;
      if (rawId === undefined || rawId === null) {
        throw new Error("facility insert returned no id");
      }
      const facilityId = Number(rawId);

      for (const verticalId of input.verticalIds) {
        await tx.execute(sql`
          insert into facility_vertical_profiles (facility_id, vertical_id)
          values (${facilityId}, ${verticalId})
          on conflict (facility_id, vertical_id) do nothing
        `);
      }

      await tx.execute(sql`
        update registry.facilities
           set atlasmed_id = ${facilityId}, updated_at = now()
         where cnes_id = ${input.cnesCode}
      `);

      return { facilityId };
    });
  }

  /**
   * Case 2 of §6.1: the facility is already ours, just invisible to this user.
   *
   * Adds profiles and nothing else. Deliberately no field writes — `location`,
   * name, CNPJ, address and unit type live on the **shared** facility row, so
   * letting this path edit them would let one vertical overwrite another's
   * curated record, and moving the pin would re-run territory assignment on
   * profiles that are not theirs.
   */
  async addVerticalProfiles(input: {
    facilityId: number;
    verticalIds: number[];
  }): Promise<{ added: number[] }> {
    const added: number[] = [];
    await db.transaction(async (tx: Tx) => {
      for (const verticalId of input.verticalIds) {
        const rows = (await tx.execute(sql`
          insert into facility_vertical_profiles (facility_id, vertical_id)
          values (${input.facilityId}, ${verticalId})
          on conflict (facility_id, vertical_id) do nothing
          returning vertical_id
        `)) as unknown as { vertical_id: number }[];
        if (rows.length > 0) added.push(verticalId);
      }
    });
    return { added };
  }
}
