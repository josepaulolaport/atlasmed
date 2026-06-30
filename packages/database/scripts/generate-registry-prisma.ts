/**
 * Generates registry.prisma models from mcp_test column metadata.
 * Run: bun packages/database/scripts/generate-registry-prisma.ts
 */
const tables: Record<string, { col: string; type: string; nullable: boolean }[]> = {
  agreement_types: [
    { col: "agreement_code", type: "text", nullable: false },
    { col: "agreement_name", type: "text", nullable: false },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  care_types: [
    { col: "care_type_code", type: "text", nullable: false },
    { col: "care_type_name", type: "text", nullable: false },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  deactivation_reasons: [
    { col: "deactivation_code", type: "text", nullable: false },
    { col: "deactivation_reason", type: "text", nullable: false },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  equipment_catalog: [
    { col: "equipment_code", type: "text", nullable: false },
    { col: "equipment_type_code", type: "text", nullable: false },
    { col: "equipment_name", type: "text", nullable: false },
    { col: "renem_code", type: "text", nullable: true },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  equipment_categories: [
    { col: "category_code", type: "text", nullable: false },
    { col: "category_name", type: "text", nullable: false },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  facilities: [
    { col: "facility_id", type: "text", nullable: false },
    { col: "cnes_code", type: "text", nullable: true },
    { col: "legal_name", type: "text", nullable: true },
    { col: "trade_name", type: "text", nullable: true },
    { col: "street_address", type: "text", nullable: true },
    { col: "street_number", type: "text", nullable: true },
    { col: "address_complement", type: "text", nullable: true },
    { col: "neighborhood", type: "text", nullable: true },
    { col: "postal_code", type: "text", nullable: true },
    { col: "municipality_id", type: "text", nullable: true },
    { col: "health_region_id", type: "text", nullable: true },
    { col: "phone_number", type: "text", nullable: true },
    { col: "fax_number", type: "text", nullable: true },
    { col: "email", type: "text", nullable: true },
    { col: "website_url", type: "text", nullable: true },
    { col: "latitude", type: "double precision", nullable: true },
    { col: "longitude", type: "double precision", nullable: true },
    { col: "tax_id_cnpj", type: "text", nullable: true },
    { col: "tax_id_cpf", type: "text", nullable: true },
    { col: "owner_tax_id", type: "text", nullable: true },
    { col: "legal_entity_type_code", type: "text", nullable: true },
    { col: "entity_type", type: "text", nullable: true },
    { col: "facility_type_code", type: "text", nullable: true },
    { col: "primary_activity_code", type: "text", nullable: true },
    { col: "unit_type_code", type: "text", nullable: true },
    { col: "operating_hours_code", type: "text", nullable: true },
    { col: "deactivation_reason_code", type: "text", nullable: true },
    { col: "is_24_7", type: "integer", nullable: true },
    { col: "is_philanthropic", type: "integer", nullable: true },
    { col: "has_internet", type: "integer", nullable: true },
    { col: "has_formal_contract", type: "integer", nullable: true },
    { col: "license_issue_date", type: "text", nullable: true },
    { col: "sanitary_license_expiry", type: "text", nullable: true },
    { col: "last_updated_date", type: "text", nullable: true },
    { col: "updated_by_user", type: "text", nullable: true },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
    { col: "unit_type_name", type: "text", nullable: true },
    { col: "unit_subtype_name", type: "text", nullable: true },
  ],
  facility_agreements: [
    { col: "facility_id", type: "text", nullable: false },
    { col: "care_type_code", type: "text", nullable: false },
    { col: "agreement_code", type: "text", nullable: false },
    { col: "updated_by_user", type: "text", nullable: true },
    { col: "last_updated_date", type: "text", nullable: true },
    { col: "origin_updated_date", type: "text", nullable: true },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  facility_equipment: [
    { col: "facility_id", type: "text", nullable: false },
    { col: "equipment_code", type: "text", nullable: false },
    { col: "equipment_category_code", type: "text", nullable: false },
    { col: "quantity", type: "integer", nullable: true },
    { col: "operational_status", type: "text", nullable: true },
    { col: "last_updated_date", type: "text", nullable: true },
    { col: "updated_by_user", type: "text", nullable: true },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  facility_physical_installations: [
    { col: "facility_id", type: "text", nullable: false },
    { col: "installation_code", type: "text", nullable: false },
    { col: "quantity", type: "integer", nullable: true },
    { col: "bed_count", type: "integer", nullable: true },
    { col: "last_updated_date", type: "text", nullable: true },
    { col: "updated_by_user", type: "text", nullable: true },
    { col: "origin_updated_date", type: "text", nullable: true },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  facility_professionals: [
    { col: "facility_id", type: "text", nullable: false },
    { col: "professional_id", type: "text", nullable: false },
    { col: "occupation_code", type: "text", nullable: false },
    { col: "municipality_id", type: "text", nullable: true },
    { col: "service_area_id", type: "text", nullable: true },
    { col: "team_sequence_number", type: "integer", nullable: true },
    { col: "service_type", type: "text", nullable: true },
    { col: "employment_type_code", type: "text", nullable: true },
    { col: "start_date", type: "text", nullable: true },
    { col: "termination_date", type: "text", nullable: true },
    { col: "micro_area_code", type: "text", nullable: true },
    { col: "other_team_cnes", type: "text", nullable: true },
    { col: "last_updated_date", type: "text", nullable: true },
    { col: "updated_by_user", type: "text", nullable: true },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  facility_representatives: [
    { col: "facility_id", type: "text", nullable: false },
    { col: "representative_name", type: "text", nullable: false },
    { col: "role_title", type: "text", nullable: true },
    { col: "email", type: "text", nullable: true },
    { col: "tax_id", type: "text", nullable: true },
    { col: "updated_by_user", type: "text", nullable: true },
    { col: "last_updated_date", type: "text", nullable: true },
    { col: "origin_updated_date", type: "text", nullable: true },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  facility_services: [
    { col: "facility_id", type: "text", nullable: false },
    { col: "service_code", type: "text", nullable: false },
    { col: "classification_code", type: "text", nullable: false },
    { col: "characteristic_type", type: "text", nullable: false },
    { col: "owner_tax_id", type: "text", nullable: false },
    { col: "address_complement", type: "text", nullable: false },
    { col: "ambulatory_capacity", type: "integer", nullable: true },
    { col: "ambulatory_capacity_sus", type: "integer", nullable: true },
    { col: "hospital_capacity", type: "integer", nullable: true },
    { col: "hospital_capacity_sus", type: "integer", nullable: true },
    { col: "is_active", type: "integer", nullable: true },
    { col: "last_updated_date", type: "text", nullable: true },
    { col: "updated_by_user", type: "text", nullable: true },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  facility_types: [
    { col: "facility_type_code", type: "text", nullable: false },
    { col: "facility_type_name", type: "text", nullable: false },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  installation_subtypes: [
    { col: "installation_subtype_code", type: "text", nullable: false },
    { col: "installation_subtype_name", type: "text", nullable: false },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  maintainers: [
    { col: "tax_id", type: "text", nullable: false },
    { col: "legal_name", type: "text", nullable: true },
    { col: "bank_code", type: "text", nullable: true },
    { col: "branch_number", type: "text", nullable: true },
    { col: "account_number", type: "text", nullable: true },
    { col: "street_address", type: "text", nullable: true },
    { col: "street_number", type: "text", nullable: true },
    { col: "address_complement", type: "text", nullable: true },
    { col: "neighborhood", type: "text", nullable: true },
    { col: "postal_code", type: "text", nullable: true },
    { col: "municipality_id", type: "text", nullable: true },
    { col: "health_region_id", type: "text", nullable: true },
    { col: "phone_number", type: "text", nullable: true },
    { col: "form_filled_date", type: "text", nullable: true },
    { col: "fms_fes_status", type: "text", nullable: true },
    { col: "fms_fes_tax_id", type: "text", nullable: true },
    { col: "legal_entity_type_code", type: "text", nullable: true },
    { col: "last_updated_date", type: "text", nullable: true },
    { col: "updated_by_user", type: "text", nullable: true },
    { col: "manager_code", type: "text", nullable: true },
    { col: "manager_municipality_id", type: "text", nullable: true },
    { col: "origin_updated_date", type: "text", nullable: true },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  municipalities: [
    { col: "municipality_id", type: "text", nullable: false },
    { col: "municipality_name", type: "text", nullable: false },
    { col: "state_code", type: "text", nullable: false },
    { col: "registration_type", type: "text", nullable: true },
    { col: "pact_type", type: "text", nullable: true },
    { col: "data_submission_type", type: "text", nullable: true },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  occupations: [
    { col: "occupation_code", type: "text", nullable: false },
    { col: "occupation_name", type: "text", nullable: false },
    { col: "professional_classification", type: "text", nullable: true },
    { col: "is_health_occupation", type: "text", nullable: true },
    { col: "is_regulated", type: "text", nullable: true },
    { col: "reference_year", type: "text", nullable: true },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  physical_installation_types: [
    { col: "installation_type_code", type: "text", nullable: false },
    { col: "installation_type_name", type: "text", nullable: false },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  physical_installations: [
    { col: "installation_code", type: "text", nullable: false },
    { col: "installation_subtype_code", type: "text", nullable: true },
    { col: "installation_name", type: "text", nullable: false },
    { col: "installation_type_code", type: "text", nullable: true },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  professional_councils: [
    { col: "council_code", type: "text", nullable: false },
    { col: "council_name", type: "text", nullable: false },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  professional_workload: [
    { col: "facility_id", type: "text", nullable: false },
    { col: "professional_id", type: "text", nullable: false },
    { col: "occupation_code", type: "text", nullable: false },
    { col: "weekly_hours_ambulatory", type: "integer", nullable: true },
    { col: "service_type", type: "text", nullable: false },
    { col: "employment_type_code", type: "text", nullable: false },
    { col: "professional_council_code", type: "text", nullable: true },
    { col: "license_number", type: "text", nullable: true },
    { col: "license_state", type: "text", nullable: true },
    { col: "is_preceptor", type: "integer", nullable: true },
    { col: "is_resident", type: "integer", nullable: true },
    { col: "last_updated_date", type: "text", nullable: true },
    { col: "updated_by_user", type: "text", nullable: true },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  professionals: [
    { col: "professional_id", type: "text", nullable: false },
    { col: "full_name", type: "text", nullable: false },
    { col: "social_name", type: "text", nullable: true },
    { col: "tax_id", type: "text", nullable: true },
    { col: "health_card_number", type: "text", nullable: true },
    { col: "nationality_code", type: "text", nullable: true },
    { col: "last_updated_date", type: "text", nullable: true },
    { col: "updated_by_user", type: "text", nullable: true },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  service_classifications: [
    { col: "classification_id", type: "text", nullable: false },
    { col: "service_specialty_code", type: "text", nullable: false },
    { col: "classification_name", type: "text", nullable: false },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  service_specialties: [
    { col: "service_code", type: "text", nullable: false },
    { col: "service_name", type: "text", nullable: false },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
  states: [
    { col: "state_code", type: "text", nullable: false },
    { col: "state_name", type: "text", nullable: false },
    { col: "created_at", type: "timestamp without time zone", nullable: true },
    { col: "updated_at", type: "timestamp without time zone", nullable: true },
  ],
};

const pks: Record<string, string[]> = {
  agreement_types: ["agreement_code"],
  care_types: ["care_type_code"],
  deactivation_reasons: ["deactivation_code"],
  equipment_catalog: ["equipment_code", "equipment_type_code"],
  equipment_categories: ["category_code"],
  facilities: ["facility_id"],
  facility_agreements: ["facility_id", "care_type_code", "agreement_code"],
  facility_equipment: ["facility_id", "equipment_code", "equipment_category_code"],
  facility_physical_installations: ["facility_id", "installation_code"],
  facility_professionals: ["facility_id", "professional_id", "occupation_code"],
  facility_representatives: ["facility_id"],
  facility_services: [
    "facility_id",
    "service_code",
    "classification_code",
    "characteristic_type",
    "owner_tax_id",
    "address_complement",
  ],
  facility_types: ["facility_type_code"],
  installation_subtypes: ["installation_subtype_code"],
  maintainers: ["tax_id"],
  municipalities: ["municipality_id"],
  occupations: ["occupation_code"],
  physical_installation_types: ["installation_type_code"],
  physical_installations: ["installation_code"],
  professional_councils: ["council_code"],
  professional_workload: [
    "facility_id",
    "professional_id",
    "occupation_code",
    "employment_type_code",
    "service_type",
  ],
  professionals: ["professional_id"],
  service_classifications: ["classification_id", "service_specialty_code"],
  service_specialties: ["service_code"],
  states: ["state_code"],
};

function toPascal(table: string): string {
  const singular = table.endsWith("ies")
    ? table.slice(0, -3) + "y"
    : table.endsWith("s")
      ? table.slice(0, -1)
      : table;
  return (
    "Registry" +
    singular
      .split("_")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("")
  );
}

function toCamel(col: string): string {
  return col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function prismaType(pgType: string, nullable: boolean): string {
  let t = "String";
  if (pgType === "integer") t = "Int";
  if (pgType === "double precision") t = "Float";
  if (pgType.startsWith("timestamp")) t = "DateTime";
  if (nullable && !pksFlat.has("")) t = `${t}?`;
  return nullable ? `${t}?` : t;
}

const pksFlat = new Set(Object.values(pks).flat());

function fieldLine(col: string, pgType: string, nullable: boolean, pkCols: string[]): string {
  const camel = toCamel(col);
  const isPk = pkCols.includes(col);
  const optional = nullable && !isPk;
  let t = "String";
  if (pgType === "integer") t = "Int";
  if (pgType === "double precision") t = "Float";
  if (pgType.startsWith("timestamp")) t = "DateTime";
  const typeWithOptional = optional ? `${t}?` : t;
  const idAttr = isPk && pkCols.length === 1 && pkCols[0] === col ? " @id" : "";
  return `  ${camel} ${typeWithOptional}${idAttr} @map("${col}")`;
}

let out = "// Auto-generated registry schema models\n\n";

for (const [table, cols] of Object.entries(tables)) {
  const model = toPascal(table);
  const pkCols = pks[table] ?? [];
  out += `model ${model} {\n`;
  for (const { col, type, nullable } of cols) {
    out += fieldLine(col, type, nullable, pkCols) + "\n";
  }
  if (pkCols.length > 1) {
    const idFields = pkCols.map(toCamel).join(", ");
    out += `\n  @@id([${idFields}])\n`;
  }
  out += `  @@map("${table}")\n  @@schema("registry")\n}\n\n`;
}

await Bun.write(
  new URL("../prisma/registry.prisma", import.meta.url).pathname,
  out
);
console.log("Wrote registry.prisma");
