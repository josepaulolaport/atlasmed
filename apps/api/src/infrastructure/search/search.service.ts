import type { SearchParams, SearchResponse, Config } from "meilisearch";
import { searchClient } from "./search.client";

/**
 * Thin search adapter.
 * Wraps Meilisearch index operations. All index naming, attribute config,
 * and ranking rules live in the callers — this service only wraps the
 * Meilisearch client primitives.
 *
 * Indexing logic (syncing facilities/professionals into search) is deferred
 * to Phase 4. This class is the infrastructure boundary that Phase 4 will use.
 */
export class SearchService {
  async search<T extends Record<string, unknown>>(
    indexName: string,
    query: string,
    params?: SearchParams
  ): Promise<SearchResponse<T>> {
    return searchClient.index<T>(indexName).search(query, params);
  }

  async addDocuments<T extends Record<string, unknown>>(
    indexName: string,
    documents: T[],
    primaryKey?: string
  ): Promise<void> {
    await searchClient.index(indexName).addDocuments(documents, { primaryKey });
  }

  async updateDocuments<T extends Record<string, unknown>>(
    indexName: string,
    documents: T[]
  ): Promise<void> {
    await searchClient.index(indexName).updateDocuments(documents);
  }

  async deleteDocument(indexName: string, documentId: string): Promise<void> {
    await searchClient.index(indexName).deleteDocument(documentId);
  }

  async deleteDocuments(
    indexName: string,
    documentIds: string[]
  ): Promise<void> {
    await searchClient.index(indexName).deleteDocuments(documentIds);
  }

  async ensureIndex(
    indexName: string,
    primaryKey: string,
    settings?: Config
  ): Promise<void> {
    await searchClient.createIndex(indexName, { primaryKey });
    if (settings) {
      await searchClient.index(indexName).updateSettings(settings as any);
    }
  }
}

export const searchService = new SearchService();
