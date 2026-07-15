import { getSearchClient, isSearchConfigured } from './search.client'

export class SearchService {
  isConfigured(): boolean {
    return isSearchConfigured()
  }

  index(name: string) {
    return getSearchClient().index(name)
  }

  async search<T extends Record<string, unknown>>(
    indexName: string,
    query: string,
    options?: { limit?: number; offset?: number }
  ) {
    return this.index(indexName).search<T>(query, options)
  }

  async addDocuments<T extends Record<string, unknown>>(indexName: string, documents: T[]) {
    return this.index(indexName).addDocuments(documents)
  }

  async updateDocuments<T extends Record<string, unknown>>(indexName: string, documents: T[]) {
    return this.index(indexName).updateDocuments(documents)
  }

  async deleteDocument(indexName: string, id: string | number) {
    return this.index(indexName).deleteDocument(id)
  }
}

export const searchService = new SearchService()
