import { MeiliSearch } from "meilisearch";
import { environment } from "../../app/config/environment";

/**
 * Meilisearch client singleton.
 * Only instantiated if MEILISEARCH_URL is configured — storage features
 * degrade gracefully when search is not available.
 */
export const searchClient = new MeiliSearch({
  host: environment.MEILISEARCH_URL,
  apiKey: environment.MEILISEARCH_API_KEY,
});
