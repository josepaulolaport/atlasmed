import { describe, expect, test } from "bun:test";
import { resolveEmultecFacility } from "./resolve-emultec-facility";

const fac = (
  id: number,
  opts: Partial<{
    idClienteEmultec: number | null;
    legalDocument: string | null;
    legalDocumentType: "CNPJ" | "CPF" | null;
  }> = {}
) => ({
  id,
  idClienteEmultec: opts.idClienteEmultec ?? null,
  legalDocument: opts.legalDocument ?? null,
  legalDocumentType: opts.legalDocumentType ?? null,
});

describe("resolveEmultecFacility", () => {
  test("prefers id_cliente_emultec stamp", () => {
    const stamped = fac(10, { idClienteEmultec: 55 });
    const byId = new Map([[55, stamped]]);
    const result = resolveEmultecFacility(
      {
        idCliente: 55,
        idClientePj: null,
        cnpjDigits: "12345678000199",
        cpfDigits: null,
        pjCnpjDigits: null,
      },
      [stamped, fac(99, { legalDocument: "12345678000199", legalDocumentType: "CNPJ" })],
      byId
    );
    expect(result).toEqual({
      ok: true,
      facilityId: 10,
      via: "id_cliente_emultec",
    });
  });

  test("PF→PJ uses PJ CNPJ only", () => {
    const result = resolveEmultecFacility(
      {
        idCliente: 1,
        idClientePj: 9,
        cnpjDigits: null,
        cpfDigits: "12345678901",
        pjCnpjDigits: "11222333000181",
      },
      [fac(7, { legalDocument: "11222333000181", legalDocumentType: "CNPJ" })],
      new Map()
    );
    expect(result).toEqual({ ok: true, facilityId: 7, via: "cnpj" });
  });

  test("ambiguous CPF → skip", () => {
    const result = resolveEmultecFacility(
      {
        idCliente: 1,
        idClientePj: null,
        cnpjDigits: null,
        cpfDigits: "12345678901",
        pjCnpjDigits: null,
      },
      [
        fac(1, { legalDocument: "12345678901", legalDocumentType: "CPF" }),
        fac(2, { legalDocument: "12345678901", legalDocumentType: "CPF" }),
      ],
      new Map()
    );
    expect(result).toEqual({ ok: false, reason: "ambiguous" });
  });

  test("no document → skip", () => {
    const result = resolveEmultecFacility(
      {
        idCliente: 1,
        idClientePj: null,
        cnpjDigits: null,
        cpfDigits: null,
        pjCnpjDigits: null,
      },
      [],
      new Map()
    );
    expect(result).toEqual({ ok: false, reason: "no_document" });
  });
});
