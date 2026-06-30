import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import path from "path";

const root = path.resolve(import.meta.dir, "..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "generated",
  ".turbo",
]);

const replacements: [string | RegExp, string][] = [
  ["FacilityProfessional", "FacilityProfessional"],
  ["facilityProfessional", "facilityProfessional"],
  ["facility_professionals", "facility_professionals"],
  ["FacilityProfessional", "FacilityProfessional"],
  ["facility-professional", "facility-professional"],
  ["facility-professional", "facility-professional"],
  ["PrismaFacilityProfessionalRepository", "PrismaFacilityProfessionalRepository"],
  ["PrismaFacilityRepository", "PrismaFacilityRepository"],
  ["PrismaProfessionalRepository", "PrismaProfessionalRepository"],
  ["prisma-facility-membership", "prisma-facility-membership"],
  ["FacilityGeocodingService", "FacilityGeocodingService"],
  ["facilityGeocodingService", "facilityGeocodingService"],
  ["facility-geocoding", "facility-geocoding"],
  ["analyticsFacilityIds", "analyticsFacilityIds"],
  ["assignFacilityById", "assignFacilityById"],
  ["assignFacilities", "assignFacilities"],
  ["assignsFacilities", "assignsFacilities"],
  ["onFacilityLocationChanged", "onFacilityLocationChanged"],
  ["handleFacilityLocationChanged", "handleFacilityLocationChanged"],
  ["facilityMembershipDeps", "facilityMembershipDeps"],
  ["facilityRepositories", "facilityRepositories"],
  ["facilityTerritoryScopePort", "facilityTerritoryScopePort"],
  ["facilityUseCases", "facilityUseCases"],
  ["facilityRepository", "facilityRepository"],
  ["facilityProfessionalRepository", "facilityProfessionalRepository"],
  ["ConfirmProfessionalAtFacilityUseCase", "ConfirmProfessionalAtFacilityUseCase"],
  ["confirmProfessionalAtFacility", "confirmProfessionalAtFacility"],
  ["EndFacilityProfessionalUseCase", "EndFacilityProfessionalUseCase"],
  ["endFacilityProfessional", "endFacilityProfessional"],
  ["ManuallyAssociateProfessionalUseCase", "ManuallyAssociateProfessionalUseCase"],
  ["manuallyAssociateProfessional", "manuallyAssociateProfessional"],
  ["ListFacilityProfessionalsUseCase", "ListFacilityProfessionalsUseCase"],
  ["listFacilityProfessionals", "listFacilityProfessionals"],
  ["CreateFacilityUseCase", "CreateFacilityUseCase"],
  ["createFacility", "createFacility"],
  ["DeleteFacilityUseCase", "DeleteFacilityUseCase"],
  ["deleteFacility", "deleteFacility"],
  ["GetFacilityUseCase", "GetFacilityUseCase"],
  ["getFacility", "getFacility"],
  ["ListFacilitiesUseCase", "ListFacilitiesUseCase"],
  ["listFacilities", "listFacilities"],
  ["UpdateFacilityUseCase", "UpdateFacilityUseCase"],
  ["updateFacility", "updateFacility"],
  ["ListProfessionalsUseCase", "ListProfessionalsUseCase"],
  ["listProfessionals", "listProfessionals"],
  ["GetProfessionalUseCase", "GetProfessionalUseCase"],
  ["getProfessional", "getProfessional"],
  ["sanitize-facility", "sanitize-facility"],
  ["sanitizeFacility", "sanitizeFacility"],
  ["sanitize-professional", "sanitize-professional"],
  ["sanitizeProfessional", "sanitizeProfessional"],
  ["FACILITY_REGISTRY_DEACTIVATED", "FACILITY_REGISTRY_DEACTIVATED"],
  ["FACILITY_REGISTRY_REACTIVATED", "FACILITY_REGISTRY_REACTIVATED"],
  ["DOCTOR_FACILITY_REGISTRY_DEACTIVATED", "FACILITY_PROFESSIONAL_REMOVAL"],
  ["FACILITY_PROFESSIONAL_CONFIRMED", "FACILITY_PROFESSIONAL_CONFIRMED"],
  ["FACILITY_PROFESSIONAL_ENDED", "FACILITY_PROFESSIONAL_ENDED"],
  ["FACILITY_PROFESSIONAL_MANUAL_ASSOCIATED", "FACILITY_PROFESSIONAL_MANUAL_ASSOCIATED"],
  ["FACILITY_REACTIVATED", "FACILITY_REACTIVATED"],
  ["facility_territory_change", "facility_territory_change"],
  ["unassigned-facilities", "unassigned-facilities"],
  ["UnassignedFacilities", "UnassignedFacilities"],
  ["findIdsByFacilityIds", "findIdsByFacilityIds"],
  ["prisma.facility", "prisma.facility"],
  ["prisma.professional", "prisma.professional"],
  ["facilityIds", "facilityIds"],
  ["facilityId", "facilityId"],
  ["professionalId", "professionalId"],
  ["facilityProfessionalId", "facilityProfessionalId"],
  ["IFacilityRepository", "IFacilityRepository"],
  ["IFacilityProfessionalRepository", "IFacilityProfessionalRepository"],
  ["IProfessionalRepository", "IProfessionalRepository"],
  ["FacilityRecord", "FacilityRecord"],
  ["ProfessionalRecord", "ProfessionalRecord"],
  ["FacilityProfessional", "FacilityProfessional"],
  ["facilitiesRoute", "facilitiesRoute"],
  ["professionalsRoute", "professionalsRoute"],
  ["/facilities", "/facilities"],
  ["/professionals", "/professionals"],
  ["modules/facility", "modules/facility"],
  ["modules/professional", "modules/professional"],
  ["from \"../clinic\"", "from \"../facility\""],
  ["from './facility'", "from './facility'"],
  ["import { facility }", "import { facility }"],
  ["import { professional }", "import { professional }"],
  [".use(facility)", ".use(facility)"],
  [".use(professional)", ".use(professional)"],
  ["export const facility", "export const facility"],
  ["export const professional", "export const professional"],
  ["Facility ", "Facility "],
  ["Professional ", "Professional "],
  ["Facility,", "Facility,"],
  ["Professional,", "Professional,"],
  ["Facility}", "Facility}"],
  ["Professional}", "Professional}"],
  ["(Facility", "(Facility"],
  ["(Professional", "(Professional"],
  ["<Facility", "<Facility"],
  ["<Professional", "<Professional"],
  ["Facility>", "Facility>"],
  ["Professional>", "Professional>"],
  ["'facilities'", "'facilities'"],
  ["\"clinics\"", "\"facilities\""],
  ["'professionals'", "'professionals'"],
  ["\"doctors\"", "\"professionals\""],
  ["facility.schema", "facility.schema"],
  ["types/facility", "types/facility"],
  ["api/facilities", "api/facilities"],
];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|json|md)$/.test(entry) && !full.includes("generated/prisma"))
      files.push(full);
  }
  return files;
}

let changed = 0;
for (const file of walk(root)) {
  let content = readFileSync(file, "utf8");
  const original = content;
  for (const [from, to] of replacements) {
    if (typeof from === "string") {
      content = content.split(from).join(to);
    } else {
      content = content.replace(from, to);
    }
  }
  if (content !== original) {
    writeFileSync(file, content);
    changed++;
  }
}

console.log(`Updated ${changed} files`);
