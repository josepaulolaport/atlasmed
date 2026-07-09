export const REGISTRY_TABLES = [
  "states",
  "municipalities",
  "agreement_types",
  "care_types",
  "deactivation_reasons",
  "equipment_categories",
  "equipment_catalog",
  "facility_types",
  "installation_subtypes",
  "physical_installation_types",
  "physical_installations",
  "occupations",
  "professional_councils",
  "service_specialties",
  "service_classifications",
  "maintainers",
  "facilities",
  "professionals",
  "facility_agreements",
  "facility_equipment",
  "facility_physical_installations",
  "facility_representatives",
  "facility_services",
  "facility_professionals",
  "professional_workload",
] as const;

export type RegistryTableName = (typeof REGISTRY_TABLES)[number];

export const CNES_REGISTRY_PROVIDER = "cnes";
