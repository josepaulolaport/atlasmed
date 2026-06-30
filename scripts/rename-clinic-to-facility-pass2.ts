import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import path from "path";

const root = path.resolve(import.meta.dir, "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "generated", ".turbo"]);

const replacements: [string, string][] = [
  ["clinic.repository.interface", "facility.repository.interface"],
  ["doctor-clinic-association.repository.interface", "facility-professional.repository.interface"],
  ["ClinicRepository", "FacilityRepository"],
  ["ClinicRecord", "FacilityRecord"],
  ["ClinicListScopeFilter", "FacilityListScopeFilter"],
  ["ClinicSourceUpsertInput", "FacilitySourceUpsertInput"],
  ["ClinicCreateInput", "FacilityCreateInput"],
  ["ClinicUpdateInput", "FacilityUpdateInput"],
  ["prisma-clinic.repository", "prisma-facility.repository"],
  ["prisma-doctor-clinic-association.repository", "prisma-facility-professional.repository"],
  ["prisma-doctor.repository", "prisma-professional.repository"],
  ["doctor.repository.interface", "professional.repository.interface"],
  ["DoctorRepository", "ProfessionalRepository"],
  ["DoctorRecord", "ProfessionalRecord"],
  ["../clinic/", "../facility/"],
  ["modules/clinic/", "modules/facility/"],
  ["modules/doctor/", "modules/professional/"],
  ["assignsFacilities", "assignsClinics"],
  ["assignFacilities", "assignClinics"],
  ["schemas/doctor.schema", "schemas/professional.schema"],
  ["canReadClinics", "canReadFacilities"],
  ["canManageClinics", "canManageFacilities"],
  ["canReadDoctors", "canReadProfessionals"],
  ["canManageDoctors", "canManageProfessionals"],
  ["mapClinic", "mapFacility"],
  ["clinics:", "facilities:"],
  ['"clinics"', '"facilities"'],
  ["DoctorClinicAssociationRepository", "FacilityProfessionalRepository"],
  ["doctorClinicAssociationRepository", "facilityProfessionalRepository"],
  ["IDoctorClinicAssociationRepository", "IFacilityProfessionalRepository"],
];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry) && !full.includes("generated/prisma")) files.push(full);
  }
  return files;
}

let changed = 0;
for (const file of walk(root)) {
  if (file.includes("rename-clinic-to-facility")) continue;
  let content = readFileSync(file, "utf8");
  const original = content;
  for (const [from, to] of replacements) content = content.split(from).join(to);
  if (content !== original) {
    writeFileSync(file, content);
    changed++;
  }
}
console.log(`Pass 2: updated ${changed} files`);
