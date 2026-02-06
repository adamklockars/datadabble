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
  getDatabases,
  getDatabase,
  createDatabase,
  updateDatabase,
  deleteDatabase,
} from '../../src/api/databases'

describe('databases API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getDatabases', () => {
    it('calls GET /databases and returns the data', async () => {
      const mockData = [
        { id: '1', title: 'Inventory', slug: 'inventory', description: 'Product inventory' },
        { id: '2', title: 'Contacts', slug: 'contacts', description: 'Customer contacts' },
      ]
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockData })

      const result = await getDatabases()

      expect(apiClient.get).toHaveBeenCalledWith('/databases')
      expect(apiClient.get).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockData)
    })

    it('returns empty array when no databases exist', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })

      const result = await getDatabases()

      expect(result).toEqual([])
    })

    it('propagates network errors', async () => {
      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Network Error'))

      await expect(getDatabases()).rejects.toThrow('Network Error')
    })
  })

  describe('getDatabase', () => {
    it('calls GET /databases/:slug and returns the data', async () => {
      const mockDb = { id: '1', title: 'Inventory', slug: 'inventory', description: 'Tracks products' }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockDb })

      const result = await getDatabase('inventory')

      expect(apiClient.get).toHaveBeenCalledWith('/databases/inventory')
      expect(result).toEqual(mockDb)
    })

    it('propagates 404 errors for non-existent slugs', async () => {
      const error = { response: { status: 404, data: { message: 'Not found' } } }
      vi.mocked(apiClient.get).mockRejectedValueOnce(error)

      await expect(getDatabase('nonexistent')).rejects.toEqual(error)
    })
  })

  describe('createDatabase', () => {
    it('calls POST /databases with title and description', async () => {
      const payload = { title: 'New DB', description: 'A new database' }
      const mockResponse = {
        message: 'Database created',
        database: { id: '3', title: 'New DB', slug: 'new-db', description: 'A new database' },
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await createDatabase(payload)

      expect(apiClient.post).toHaveBeenCalledWith('/databases', payload)
      expect(result).toEqual(mockResponse)
      expect(result.database.slug).toBe('new-db')
    })

    it('calls POST /databases with title only', async () => {
      const payload = { title: 'Minimal DB' }
      const mockResponse = {
        message: 'Database created',
        database: { id: '4', title: 'Minimal DB', slug: 'minimal-db' },
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await createDatabase(payload)

      expect(apiClient.post).toHaveBeenCalledWith('/databases', payload)
      expect(result.message).toBe('Database created')
    })

    it('propagates validation errors', async () => {
      const error = { response: { status: 400, data: { message: 'Title is required' } } }
      vi.mocked(apiClient.post).mockRejectedValueOnce(error)

      await expect(createDatabase({ title: '' })).rejects.toEqual(error)
    })
  })

  describe('updateDatabase', () => {
    it('calls PUT /databases/:slug with updated fields', async () => {
      const payload = { title: 'Updated Title', description: 'Updated description' }
      const mockResponse = {
        message: 'Database updated',
        database: { id: '1', title: 'Updated Title', slug: 'updated-title', description: 'Updated description' },
      }
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: mockResponse })

      const result = await updateDatabase('inventory', payload)

      expect(apiClient.put).toHaveBeenCalledWith('/databases/inventory', payload)
      expect(result).toEqual(mockResponse)
    })

    it('allows partial updates with only title', async () => {
      const payload = { title: 'New Title Only' }
      const mockResponse = {
        message: 'Database updated',
        database: { id: '1', title: 'New Title Only', slug: 'new-title-only', description: 'Original desc' },
      }
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: mockResponse })

      const result = await updateDatabase('inventory', payload)

      expect(apiClient.put).toHaveBeenCalledWith('/databases/inventory', payload)
      expect(result.database.title).toBe('New Title Only')
    })
  })

  describe('deleteDatabase', () => {
    it('calls DELETE /databases/:slug and returns confirmation', async () => {
      const mockResponse = { message: 'Database deleted' }
      vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: mockResponse })

      const result = await deleteDatabase('inventory')

      expect(apiClient.delete).toHaveBeenCalledWith('/databases/inventory')
      expect(result).toEqual(mockResponse)
    })

    it('propagates errors when deletion fails', async () => {
      const error = { response: { status: 403, data: { message: 'Forbidden' } } }
      vi.mocked(apiClient.delete).mockRejectedValueOnce(error)

      await expect(deleteDatabase('inventory')).rejects.toEqual(error)
    })
  })
})
