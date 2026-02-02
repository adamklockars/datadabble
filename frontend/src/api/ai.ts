import apiClient from './client'

export interface InsightsResponse {
  insights: string
}

export interface AskResponse {
  answer: string
}

export interface SuggestQueryResponse {
  query: string
}

export async function getInsights(databaseSlug: string): Promise<InsightsResponse> {
  const response = await apiClient.post<InsightsResponse>(`/databases/${databaseSlug}/ai/insights`)
  return response.data
}

export async function askQuestion(databaseSlug: string, question: string): Promise<AskResponse> {
  const response = await apiClient.post<AskResponse>(`/databases/${databaseSlug}/ai/ask`, { question })
  return response.data
}

export async function suggestQuery(databaseSlug: string, description: string): Promise<SuggestQueryResponse> {
  const response = await apiClient.post<SuggestQueryResponse>(`/databases/${databaseSlug}/ai/suggest-query`, { description })
  return response.data
}
