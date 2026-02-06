export interface OAuthScope {
  name: string
  description: string
}

export interface OAuthClient {
  id: string
  client_id: string
  name: string
  description: string
  redirect_uris: string[]
  scopes: string[]
  active: boolean
  user_id: string
  account_id: string | null
  created_at: string
  updated_at: string
}

export interface OAuthClientWithSecret extends OAuthClient {
  client_secret: string
}

export interface CreateClientData {
  name: string
  description?: string
  redirect_uris: string[]
  scopes: string[]
}

export interface UpdateClientData {
  name?: string
  description?: string
  redirect_uris?: string[]
  scopes?: string[]
  active?: boolean
}

export interface ConsentInfo {
  client: {
    client_id: string
    name: string
    description: string
  }
  scopes: OAuthScope[]
  redirect_uri: string
  state: string
}

export interface ConsentResponse {
  redirect_uri: string
  code?: string
  error?: string
  state: string
}
