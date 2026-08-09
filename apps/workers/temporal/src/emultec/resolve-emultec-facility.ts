export type EmultecClientForFacilityResolve = {
  idCliente: number;
  idClientePj: number | null;
  /** Digits-only CNPJ on the avulsa client row (may be empty for PF). */
  cnpjDigits: string | null;
  /** Digits-only CPF on the avulsa client row. */
  cpfDigits: string | null;
  /** Digits-only CNPJ of PJ parent when Id_Cliente_PJ set. */
  pjCnpjDigits: string | null;
};

export type CnesEligibleFacility = {
  id: number;
  idClienteEmultec: number | null;
  legalDocument: string | null;
  legalDocumentType: "CNPJ" | "CPF" | null;
};

export type FacilityResolveResult =
  | { ok: true; facilityId: number; via: "id_cliente_emultec" | "cnpj" | "cpf" }
  | {
      ok: false;
      reason:
        | "no_match"
        | "ambiguous"
        | "no_document"
        | "id_cliente_not_cnes_eligible";
    };

/**
 * Pure facility resolve per import locks.
 * `candidates` must already be CNES-eligible (cnes_code set, active).
 */
export function resolveEmultecFacility(
  client: EmultecClientForFacilityResolve,
  candidates: CnesEligibleFacility[],
  byIdCliente: Map<number, CnesEligibleFacility>
): FacilityResolveResult {
  const stamped = byIdCliente.get(client.idCliente);
  if (stamped) {
    return { ok: true, facilityId: stamped.id, via: "id_cliente_emultec" };
  }

  // PF→PJ: match PJ CNPJ only; never stamp PF onto id_cliente_emultec.
  if (client.idClientePj != null) {
    const digits = client.pjCnpjDigits;
    if (!digits || digits.length !== 14) {
      return { ok: false, reason: "no_document" };
    }
    return matchByDigits(candidates, digits, "CNPJ");
  }

  if (client.cnpjDigits && client.cnpjDigits.length === 14) {
    return matchByDigits(candidates, client.cnpjDigits, "CNPJ");
  }

  if (client.cpfDigits && client.cpfDigits.length === 11) {
    return matchByDigits(candidates, client.cpfDigits, "CPF");
  }

  return { ok: false, reason: "no_document" };
}

function matchByDigits(
  candidates: CnesEligibleFacility[],
  digits: string,
  type: "CNPJ" | "CPF"
): FacilityResolveResult {
  const matches = candidates.filter(
    (f) =>
      f.legalDocument === digits &&
      (f.legalDocumentType === type || f.legalDocumentType == null)
  );
  if (matches.length === 0) return { ok: false, reason: "no_match" };
  if (matches.length > 1) return { ok: false, reason: "ambiguous" };
  return {
    ok: true,
    facilityId: matches[0]!.id,
    via: type === "CNPJ" ? "cnpj" : "cpf",
  };
}
