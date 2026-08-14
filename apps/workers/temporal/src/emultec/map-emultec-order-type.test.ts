import { describe, expect, test } from "bun:test";
import { mapEmultecOrderType } from "./map-emultec-order-type";

describe("mapEmultecOrderType", () => {
  test("VENDA is a sale", () => {
    expect(mapEmultecOrderType("VENDA")).toBe("SALE");
    expect(mapEmultecOrderType(" venda ")).toBe("SALE");
  });

  test("DOACAO is a donation, accented or not", () => {
    // A third of the whitelist volume. Emultec writes it unaccented; the
    // accented spelling is accepted so a data-entry change cannot silently
    // reclassify donations as sales.
    expect(mapEmultecOrderType("DOACAO")).toBe("DONATION");
    expect(mapEmultecOrderType("doação")).toBe("DONATION");
  });

  test("a blank nature is a sale", () => {
    expect(mapEmultecOrderType("")).toBe("SALE");
    expect(mapEmultecOrderType(null)).toBe("SALE");
    expect(mapEmultecOrderType(undefined)).toBe("SALE");
  });

  test("an unrecognised nature stays out of the funnel", () => {
    // OTHER, never SALE: the funnel counts SALE and CONSIGNMENT, so guessing
    // "sale" is what silently admits an unknown movement to purchase history.
    expect(mapEmultecOrderType("COMODATO")).toBe("OTHER");
    expect(mapEmultecOrderType("BONIFICACAO")).toBe("OTHER");
    expect(mapEmultecOrderType("REMESSA")).toBe("OTHER");
  });
});
