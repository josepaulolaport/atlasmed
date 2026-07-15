import type { PaginatedResponse } from '@/types/api'
import type { RegistryDemoResult, RegistrySuggestion } from '@/types/facility'
import apiClient from './client'

export {
  clinicDoctorsApi,
  facilityDoctorsApi,
  facilityProfessionalsApi
} from './facility-professionals'

export const registryApi = {
  runIngestion: async () => {
    const response = await apiClient.post('/registry-ingestion/run')
    return response.data
  },

  runDemoScenario: async (): Promise<RegistryDemoResult> => {
    const response = await apiClient.post<RegistryDemoResult>('/registry-ingestion/demo')
    return response.data
  },

  getSuggestions: async (params?: {
    page?: number
    limit?: number
    status?: string
    type?: string
  }): Promise<PaginatedResponse<RegistrySuggestion>> => {
    const response = await apiClient.get<PaginatedResponse<RegistrySuggestion>>(
      '/registry-suggestions',
      { params }
    )
    return response.data
  },

  approveSuggestion: async (id: string, resolutionNote?: string) => {
    const response = await apiClient.post(`/registry-suggestions/${id}/approve`, {
      resolutionNote
    })
    return response.data
  },

  rejectSuggestion: async (id: string, resolutionNote?: string) => {
    const response = await apiClient.post(`/registry-suggestions/${id}/reject`, {
      resolutionNote
    })
    return response.data
  }
}
