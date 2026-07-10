import { MeiliSearch } from "meilisearch";
import { environment } from "../../app/config/environment";

let client: MeiliSearch | null = null;

export function isSearchConfigured(): boolean {
  return Boolean(environment.MEILISEARCH_URL);
}

export function getSearchClient(): MeiliSearch {
  if (!isSearchConfigured()) {
    throw new Error("Meilisearch is not configured");
  }

  if (!client) {
    client = new MeiliSearch({
      host: environment.MEILISEARCH_URL!,
      ...(environment.MEILISEARCH_API_KEY
        ? { apiKey: environment.MEILISEARCH_API_KEY }
        : {}),
    });
  }

  return client;
}
