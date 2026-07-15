import { Meilisearch } from 'meilisearch'
import { environment } from '../../app/config/environment'

let client: Meilisearch | null = null

export function isSearchConfigured(): boolean {
  return Boolean(environment.MEILISEARCH_URL)
}

export function getSearchClient(): Meilisearch {
  if (!isSearchConfigured()) {
    throw new Error('Meilisearch is not configured')
  }

  if (!client) {
    client = new Meilisearch({
      // biome-ignore lint/style/noNonNullAssertion: guarded by isSearchConfigured()
      host: environment.MEILISEARCH_URL!,
      ...(environment.MEILISEARCH_API_KEY ? { apiKey: environment.MEILISEARCH_API_KEY } : {})
    })
  }

  return client
}
