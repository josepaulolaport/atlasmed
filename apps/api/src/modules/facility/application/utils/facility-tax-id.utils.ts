/** Prefer stored taxIdType; otherwise infer from CNPJ/CPF identifiers. */
export function resolveFacilityTaxIdType(facility: {
  taxIdType: "PF" | "PJ" | null;
  cnpj: string | null;
  cpf: string | null;
}): "PF" | "PJ" | null {
  if (facility.taxIdType === "PF" || facility.taxIdType === "PJ") {
    return facility.taxIdType;
  }
  const cnpj = facility.cnpj?.replace(/\D/g, "") ?? "";
  if (cnpj.length === 14) return "PJ";
  const cpf = facility.cpf?.replace(/\D/g, "") ?? "";
  if (cpf.length === 11) return "PF";
  return null;
}
