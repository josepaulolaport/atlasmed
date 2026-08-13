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

export type ResolvableFacility = {
  id: number;
  idClienteEmultec: number | null;
  legalDocument: string | null;
  legalDocumentType: "CNPJ" | "CPF" | null;
};

export type FacilityResolveResult =
  | { ok: true; facilityId: number; via: "id_cliente_emultec" | "cnpj" | "cpf" }
  | {
      ok: false;
      reason: "no_match" | "ambiguous" | "no_document";
    };

/**
 * Pure facility resolve: stamp → PF→PJ CNPJ → CNPJ-14 → CPF-11.
 *
 * `candidates` must be active (`deactivated_at is null`). They used to also be
 * required to carry a `cnes_code`, which meant a facility matching the client's
 * CNPJ exactly was invisible to the importer unless it was CNES-registered —
 * a rule that blocks individual surgeons and distributors by construction.
 * Identity here is the document and the Emultec client id; CNES registration is
 * a property of the establishment, not a precondition for recognising it.
 */
export function resolveEmultecFacility(
  client: EmultecClientForFacilityResolve,
  candidates: ResolvableFacility[],
  byIdCliente: Map<number, ResolvableFacility>
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
  candidates: ResolvableFacility[],
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
