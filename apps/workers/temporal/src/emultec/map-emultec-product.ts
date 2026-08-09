export type EmultecProductRow = {
  id: number;
  codigo: string | null;
  codigoBarra: string | null;
  codigoComercial: string | null;
  descricao: string;
  grupo: string | null;
  marca: string | null;
  tipo: string | null;
};

export type MappedCrmProduct = {
  idProdutoEmultec: number;
  code: string;
  name: string;
  description: string;
  barcode: string | null;
  commercialCode: string | null;
  productGroup: string | null;
  brand: string | null;
  productClassification: string | null;
  /** Placeholder unique codes until Brasíndice/Simpro/TISS are curated. */
  simproCode: string;
  brasindiceCode: string;
  tissCode: string;
  manufacturer: string;
  countryOfOrigin: string;
  price: string;
  price17: string;
  price18: string;
  price20: string;
  brasindiceUpdatedAt: string;
  isActive: boolean;
};

function looksLikeScientificCodigo(value: string): boolean {
  return /e\+/i.test(value) || value.includes(",");
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Prefer barcode digits, else commercial/codigo when not junk, else EMULTEC-{id}.
 */
export function pickProductCode(row: EmultecProductRow): string {
  const barcode = row.codigoBarra?.trim() ?? "";
  const barcodeDigits = digitsOnly(barcode);
  if (barcodeDigits.length >= 8) return barcodeDigits;

  const commercial = row.codigoComercial?.trim() ?? "";
  if (commercial && !looksLikeScientificCodigo(commercial)) {
    return commercial.slice(0, 64);
  }

  const codigo = row.codigo?.trim() ?? "";
  if (codigo && !looksLikeScientificCodigo(codigo) && codigo.toUpperCase() !== "CATALOGO") {
    return codigo.slice(0, 64);
  }

  return `EMULTEC-${row.id}`;
}

export function mapEmultecProductToCrm(row: EmultecProductRow): MappedCrmProduct {
  const name = row.descricao.trim() || `Emultec product ${row.id}`;
  const brand = row.marca?.trim() || null;
  const code = pickProductCode(row);

  return {
    idProdutoEmultec: row.id,
    code,
    name,
    description: name,
    barcode: row.codigoBarra?.trim() || null,
    commercialCode: row.codigoComercial?.trim() || null,
    productGroup: row.grupo?.trim() || null,
    brand,
    productClassification: row.tipo?.trim() || null,
    simproCode: `EMULTEC-SIM-${row.id}`,
    brasindiceCode: `EMULTEC-BRA-${row.id}`,
    tissCode: `EMULTEC-TISS-${row.id}`,
    manufacturer: brand || "Emultec",
    countryOfOrigin: "BR",
    price: "0",
    price17: "0",
    price18: "0",
    price20: "0",
    brasindiceUpdatedAt: "1970-01-01",
    isActive: true,
  };
}
