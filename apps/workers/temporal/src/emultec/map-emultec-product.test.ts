import { describe, expect, test } from "bun:test";
import {
  mapEmultecProductToCrm,
  pickProductCode,
} from "./map-emultec-product";

describe("mapEmultecProductToCrm", () => {
  test("prefers barcode digits for code", () => {
    expect(
      pickProductCode({
        id: 3,
        codigo: "4064544237649",
        codigoBarra: "4064544237649",
        codigoComercial: null,
        descricao: "REVISCON MONO 2.0%",
        grupo: null,
        marca: "BIOMATERIAL",
        tipo: null,
      })
    ).toBe("4064544237649");
  });

  test("falls back to EMULTEC-id when codigo is scientific junk", () => {
    expect(
      pickProductCode({
        id: 827,
        codigo: "8,7188E+12",
        codigoBarra: null,
        codigoComercial: null,
        descricao: "REVISCON MONO 2.0%",
        grupo: null,
        marca: null,
        tipo: null,
      })
    ).toBe("EMULTEC-827");
  });

  test("maps placeholder pricing codes per emultec id", () => {
    const mapped = mapEmultecProductToCrm({
      id: 2429,
      codigo: "4064544237656",
      codigoBarra: "4064544237656",
      codigoComercial: null,
      descricao: "EVISC 1.0% - ARTIGO ORTOP",
      grupo: null,
      marca: "BIOMATERIAL",
      tipo: null,
    });
    expect(mapped.idProdutoEmultec).toBe(2429);
    expect(mapped.simproCode).toBe("EMULTEC-SIM-2429");
    expect(mapped.brasindiceCode).toBe("EMULTEC-BRA-2429");
    expect(mapped.tissCode).toBe("EMULTEC-TISS-2429");
    expect(mapped.manufacturer).toBe("BIOMATERIAL");
    expect(mapped.countryOfOrigin).toBe("BR");
  });
});
