import {
  getEmultecOrderWatermark,
  importEmultecOrdersPage,
  type ImportEmultecOrdersPageInput,
  type ImportEmultecOrdersPageResult,
} from "../emultec/import-emultec-orders";

export async function importEmultecOrdersPageActivity(
  input: ImportEmultecOrdersPageInput
): Promise<ImportEmultecOrdersPageResult> {
  return importEmultecOrdersPage(input);
}

export async function getEmultecOrderWatermarkActivity(): Promise<number> {
  return getEmultecOrderWatermark();
}
