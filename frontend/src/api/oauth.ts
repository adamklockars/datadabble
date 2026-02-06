import { apiClient } from './client'
import type { AuthResponse } from '../types'

export async function getOAuthAuthorizeUrl(provider: string): Promise<{
  authorization_url: string
  state: string
}> {
  const { data } = await apiClient.get(`/auth/oauth/${provider}/authorize`)
  return data
}

export async function handleOAuthCallback(
  provider: string,
  code: string,
  state: string
): Promise<AuthResponse> {
  const { data } = await apiClient.post(`/auth/oauth/${provider}/callback`, { code, state })
  return data
}
