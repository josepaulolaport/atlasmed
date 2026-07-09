import type { CnesReference } from "./cnes-ftp.port";

/** CNES CSV base name (without YYYYMM suffix) → registry warehouse table(s). */
export const CNES_CSV_BASE_MAPPING: Record<string, string[]> = {
  tbEstado: ["states"],
  tbMunicipio: ["municipalities"],
  tbTipoEstabelecimento: ["facility_types"],
  tbMotivoDesativacao: ["deactivation_reasons"],
  tbServicoEspecializado: ["service_specialties"],
  tbEquipamento: ["equipment_catalog"],
  tbConselhoClasse: ["professional_councils"],
  tbTipoEquipamento: ["equipment_categories"],
  tbClassificacaoServico: ["service_classifications"],
  tbTipoUnidade: ["physical_installations"],
  tbSubTipo: ["physical_installations"],
  rlEstabSubTipo: ["physical_installations"],
  tbConvenio: ["agreement_types"],
  tbAtendimentoPrestado: ["care_types"],
  tbAtividadeProfissional: ["occupations"],
  tbSubtipoInstalacao: ["installation_subtypes"],
  tbTipoInstalacaoFisica: ["physical_installation_types"],
  tbInstalFisicaParaAssist: ["physical_installations"],
  tbMantenedora: ["maintainers"],
  tbEstabelecimento: ["facilities"],
  tbDadosProfissionalSus: ["professionals"],
  rlEstabEquipeProf: ["facility_professionals"],
  rlEstabServClass: ["facility_services"],
  rlEstabEquipamento: ["facility_equipment"],
  tbCargaHorariaSus: ["professional_workload"],
  rlEstabAtendPrestConv: ["facility_agreements"],
  rlEstabInstFisiAssist: ["facility_physical_installations"],
  rlEstabRepresentante: ["facility_representatives"],
};

/** @deprecated Use CNES_CSV_BASE_MAPPING with version suffix helpers. */
export const CNES_FILE_TABLE_MAPPING: Record<string, string[]> = CNES_CSV_BASE_MAPPING;

export function expectedCnesCsvFiles(cnesVersion: string): string[] {
  return Object.keys(CNES_CSV_BASE_MAPPING).map((base) => `${base}${cnesVersion}.csv`);
}

export function tablesForCnesFile(fileName: string): string[] {
  const withoutVersion = fileName.replace(/\d{6}\.csv$/i, ".csv");
  const baseName = withoutVersion.replace(/\.csv$/i, "");
  return CNES_CSV_BASE_MAPPING[baseName] ?? [];
}

export function extractedFolderName(reference: CnesReference): string {
  const version = `${reference.ano}${String(reference.mes).padStart(2, "0")}`;
  return `BASE_DE_DADOS_CNES_${version}`;
}
