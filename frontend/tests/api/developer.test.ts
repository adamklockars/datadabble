import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import apiClient from '../../src/api/client'
import {
  getScopes,
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  rotateSecret,
  getConsentInfo,
  submitConsent,
} from '../../src/api/developer'

describe('developer API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getScopes', () => {
    it('calls GET /developer/scopes and returns scope list', async () => {
      const mockScopes = [
        { id: 'read:databases', description: 'Read databases' },
        { id: 'write:databases', description: 'Write databases' },
        { id: 'read:entries', description: 'Read entries' },
      ]
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { scopes: mockScopes } })

      const result = await getScopes()

      expect(apiClient.get).toHaveBeenCalledWith('/developer/scopes')
      expect(result).toEqual(mockScopes)
      expect(result).toHaveLength(3)
    })

    it('returns empty array when no scopes available', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { scopes: [] } })

      const result = await getScopes()

      expect(result).toEqual([])
    })
  })

  describe('getClients', () => {
    it('calls GET /developer/clients and returns client list', async () => {
      const mockClients = [
        { id: 'c1', name: 'My App', redirect_uris: ['http://localhost:3000/callback'] },
        { id: 'c2', name: 'Another App', redirect_uris: ['https://example.com/callback'] },
      ]
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { clients: mockClients } })

      const result = await getClients()

      expect(apiClient.get).toHaveBeenCalledWith('/developer/clients')
      expect(result).toEqual(mockClients)
    })
  })

  describe('getClient', () => {
    it('calls GET /developer/clients/:id and returns the full response data', async () => {
      const mockClient = {
        id: 'c1',
        name: 'My App',
        redirect_uris: ['http://localhost:3000/callback'],
        scopes: ['read:databases'],
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockClient })

      const result = await getClient('c1')

      expect(apiClient.get).toHaveBeenCalledWith('/developer/clients/c1')
      expect(result).toEqual(mockClient)
    })

    it('propagates 404 errors', async () => {
      const error = { response: { status: 404, data: { message: 'Client not found' } } }
      vi.mocked(apiClient.get).mockRejectedValueOnce(error)

      await expect(getClient('nonexistent')).rejects.toEqual(error)
    })
  })

  describe('createClient', () => {
    it('calls POST /developer/clients and returns client with secret', async () => {
      const payload = {
        name: 'New App',
        redirect_uris: ['https://myapp.com/callback'],
        scopes: ['read:databases', 'read:entries'],
      }
      const mockResponse = {
        message: 'Client created',
        client: {
          id: 'c3',
          name: 'New App',
          client_secret: 'secret_abc123xyz',
          redirect_uris: ['https://myapp.com/callback'],
          scopes: ['read:databases', 'read:entries'],
        },
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await createClient(payload)

      expect(apiClient.post).toHaveBeenCalledWith('/developer/clients', payload)
      expect(result.message).toBe('Client created')
      expect(result.client.client_secret).toBe('secret_abc123xyz')
    })
  })

  describe('updateClient', () => {
    it('calls PUT /developer/clients/:id and returns updated client from data.client', async () => {
      const payload = { name: 'Renamed App' }
      const mockClient = {
        id: 'c1',
        name: 'Renamed App',
        redirect_uris: ['http://localhost:3000/callback'],
      }
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { client: mockClient } })

      const result = await updateClient('c1', payload)

      expect(apiClient.put).toHaveBeenCalledWith('/developer/clients/c1', payload)
      expect(result).toEqual(mockClient)
      expect(result.name).toBe('Renamed App')
    })

    it('updates redirect_uris', async () => {
      const payload = { redirect_uris: ['https://new-url.com/callback', 'https://other.com/callback'] }
      const mockClient = { id: 'c1', name: 'My App', redirect_uris: payload.redirect_uris }
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { client: mockClient } })

      const result = await updateClient('c1', payload)

      expect(result.redirect_uris).toEqual(payload.redirect_uris)
    })
  })

  describe('deleteClient', () => {
    it('calls DELETE /developer/clients/:id', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: {} })

      await deleteClient('c1')

      expect(apiClient.delete).toHaveBeenCalledWith('/developer/clients/c1')
    })

    it('does not return a value', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: {} })

      const result = await deleteClient('c1')

      expect(result).toBeUndefined()
    })
  })

  describe('rotateSecret', () => {
    it('calls POST /developer/clients/:id/rotate-secret and returns client with new secret', async () => {
      const mockClient = {
        id: 'c1',
        name: 'My App',
        client_secret: 'new_secret_xyz789',
        redirect_uris: ['http://localhost:3000/callback'],
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { client: mockClient } })

      const result = await rotateSecret('c1')

      expect(apiClient.post).toHaveBeenCalledWith('/developer/clients/c1/rotate-secret')
      expect(result).toEqual(mockClient)
      expect(result.client_secret).toBe('new_secret_xyz789')
    })
  })

  describe('getConsentInfo', () => {
    it('calls GET /oauth2/authorize with query params', async () => {
      const params = {
        client_id: 'c1',
        redirect_uri: 'https://myapp.com/callback',
        scope: 'read:databases read:entries',
        state: 'random_state_123',
        response_type: 'code',
      }
      const mockConsentInfo = {
        client_name: 'My App',
        scopes: [
          { id: 'read:databases', description: 'Read databases' },
          { id: 'read:entries', description: 'Read entries' },
        ],
        redirect_uri: 'https://myapp.com/callback',
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockConsentInfo })

      const result = await getConsentInfo(params)

      expect(apiClient.get).toHaveBeenCalledWith('/oauth2/authorize', { params })
      expect(result).toEqual(mockConsentInfo)
    })

    it('works without optional state and response_type', async () => {
      const params = {
        client_id: 'c1',
        redirect_uri: 'https://myapp.com/callback',
        scope: 'read:databases',
      }
      const mockConsentInfo = {
        client_name: 'My App',
        scopes: [{ id: 'read:databases', description: 'Read databases' }],
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockConsentInfo })

      const result = await getConsentInfo(params)

      expect(apiClient.get).toHaveBeenCalledWith('/oauth2/authorize', { params })
      expect(result.client_name).toBe('My App')
    })
  })

  describe('submitConsent', () => {
    it('calls POST /oauth2/authorize with approval payload', async () => {
      const payload = {
        client_id: 'c1',
        redirect_uri: 'https://myapp.com/callback',
        scopes: ['read:databases', 'read:entries'],
        state: 'random_state_123',
        approved: true,
      }
      const mockResponse = {
        redirect_uri: 'https://myapp.com/callback?code=auth_code_abc&state=random_state_123',
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await submitConsent(payload)

      expect(apiClient.post).toHaveBeenCalledWith('/oauth2/authorize', payload)
      expect(result.redirect_uri).toContain('code=auth_code_abc')
    })

    it('handles denied consent', async () => {
      const payload = {
        client_id: 'c1',
        redirect_uri: 'https://myapp.com/callback',
        scopes: ['read:databases'],
        state: 'random_state_123',
        approved: false,
      }
      const mockResponse = {
        redirect_uri: 'https://myapp.com/callback?error=access_denied&state=random_state_123',
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await submitConsent(payload)

      expect(apiClient.post).toHaveBeenCalledWith('/oauth2/authorize', payload)
      expect(result.redirect_uri).toContain('error=access_denied')
    })
  })
})
