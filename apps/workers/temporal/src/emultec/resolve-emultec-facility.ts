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
 * Pure facility resolve: stamp → PF→PJ CNPJ → own CNPJ-14 → own CPF-11.
 *
 * `candidates` must be active (`deactivated_at is null`). They used to also be
 * required to carry a `cnes_code`, which meant a facility matching the client's
 * CNPJ exactly was invisible to the importer unless it was CNES-registered —
 * a rule that blocks individual surgeons and distributors by construction.
 * Identity here is the document and the Emultec client id; CNES registration is
 * a property of the establishment, not a precondition for recognising it.
 *
 * A client that carries both documents gets both tried. Emultec fills CNPJ and
 * CPF on the same row for a surgeon trading through their own company, and the
 * order in which the two databases recorded them does not agree: we may hold the
 * CPF while Emultec leads with the CNPJ. Stopping at the first document that
 * failed to match dropped those orders even though the facility was right there
 * under the other one.
 *
 * `ambiguous` still wins over trying the next document — two active facilities
 * sharing a document is a data problem to fix, not something to route around.
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

  const attempts: Array<{ digits: string; type: "CNPJ" | "CPF" }> = [];

  // PF→PJ leads with the parent company's CNPJ. The buyer's own CPF is still
  // worth trying after it — but it is never stamped, since many pessoa-física
  // buyers hang off one parent.
  if (client.idClientePj != null) {
    if (client.pjCnpjDigits?.length === 14) {
      attempts.push({ digits: client.pjCnpjDigits, type: "CNPJ" });
    }
  } else if (client.cnpjDigits?.length === 14) {
    attempts.push({ digits: client.cnpjDigits, type: "CNPJ" });
  }

  if (client.cpfDigits?.length === 11) {
    attempts.push({ digits: client.cpfDigits, type: "CPF" });
  }

  if (attempts.length === 0) return { ok: false, reason: "no_document" };

  for (const attempt of attempts) {
    const result = matchByDigits(candidates, attempt.digits, attempt.type);
    if (result.ok || result.reason === "ambiguous") return result;
  }

  return { ok: false, reason: "no_match" };
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
