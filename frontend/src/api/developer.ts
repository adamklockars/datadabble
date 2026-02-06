import apiClient from './client'
import type {
  OAuthClient,
  OAuthClientWithSecret,
  OAuthScope,
  CreateClientData,
  UpdateClientData,
  ConsentInfo,
  ConsentResponse,
} from '../types/developer'

export async function getScopes(): Promise<OAuthScope[]> {
  const { data } = await apiClient.get('/developer/scopes')
  return data.scopes
}

export async function getClients(): Promise<OAuthClient[]> {
  const { data } = await apiClient.get('/developer/clients')
  return data.clients
}

export async function getClient(clientId: string): Promise<OAuthClient> {
  const { data } = await apiClient.get(`/developer/clients/${clientId}`)
  return data
}

export async function createClient(payload: CreateClientData): Promise<{ message: string; client: OAuthClientWithSecret }> {
  const { data } = await apiClient.post('/developer/clients', payload)
  return data
}

export async function updateClient(clientId: string, payload: UpdateClientData): Promise<OAuthClient> {
  const { data } = await apiClient.put(`/developer/clients/${clientId}`, payload)
  return data.client
}

export async function deleteClient(clientId: string): Promise<void> {
  await apiClient.delete(`/developer/clients/${clientId}`)
}

export async function rotateSecret(clientId: string): Promise<OAuthClientWithSecret> {
  const { data } = await apiClient.post(`/developer/clients/${clientId}/rotate-secret`)
  return data.client
}

export async function getConsentInfo(params: {
  client_id: string
  redirect_uri: string
  scope: string
  state?: string
  response_type?: string
}): Promise<ConsentInfo> {
  const { data } = await apiClient.get('/oauth2/authorize', { params })
  return data
}

export async function submitConsent(payload: {
  client_id: string
  redirect_uri: string
  scopes: string[]
  state: string
  approved: boolean
}): Promise<ConsentResponse> {
  const { data } = await apiClient.post('/oauth2/authorize', payload)
  return data
}
