/**
 * Slice 1: upsert Emultec EVISC/REVISCON/TRUVISC whitelist into CRM products.
 *
 * Requires:
 *   DATABASE_URL
 *   EMULTEC_MYSQL_HOST / USER / PASSWORD [/ PORT / DATABASE]
 *   Docker (mysql:8 client image) with network access to Emultec host
 *
 * Usage (from apps/workers/temporal):
 *   bun src/scripts/sync-emultec-products.ts
 */
import { fetchEmultecWhitelistProducts } from "../emultec/fetch-emultec-products";
import { upsertEmultecProducts } from "../emultec/upsert-emultec-products";

async function main() {
  const source = await fetchEmultecWhitelistProducts();
  console.log(`Fetched ${source.length} Emultec products`);
  for (const row of source) {
    console.log(`  - ${row.id}: ${row.descricao.slice(0, 72)}`);
  }

  const result = await upsertEmultecProducts(source);
  console.log(
    JSON.stringify(
      {
        upserted: result.upserted,
        verticalLinksAdded: result.verticalLinks,
        productIdsByEmultecId: result.productIdsByEmultecId,
      },
      null,
      2
    )
  );
}

main()
  .then(() => {
    // pg pool keeps the event loop alive otherwise
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
