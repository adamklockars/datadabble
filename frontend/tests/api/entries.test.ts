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
  getEntries,
  validateFilter,
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry,
} from '../../src/api/entries'

describe('entries API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getEntries', () => {
    it('calls GET /databases/:slug/entries with default pagination', async () => {
      const mockResponse = {
        entries: [{ id: 'e1', values: { name: 'Widget' } }],
        pagination: { page: 1, per_page: 20, total: 1, pages: 1 },
        filter: null,
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await getEntries('inventory')

      expect(apiClient.get).toHaveBeenCalledWith('/databases/inventory/entries', {
        params: { page: 1, per_page: 20 },
      })
      expect(result).toEqual(mockResponse)
    })

    it('passes custom pagination options', async () => {
      const mockResponse = {
        entries: [],
        pagination: { page: 3, per_page: 10, total: 25, pages: 3 },
        filter: null,
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await getEntries('inventory', { page: 3, perPage: 10 })

      expect(apiClient.get).toHaveBeenCalledWith('/databases/inventory/entries', {
        params: { page: 3, per_page: 10 },
      })
      expect(result.pagination.page).toBe(3)
    })

    it('includes filter parameter when provided', async () => {
      const mockResponse = {
        entries: [{ id: 'e2', values: { status: 'active' } }],
        pagination: { page: 1, per_page: 20, total: 1, pages: 1 },
        filter: 'status = "active"',
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await getEntries('inventory', { filter: 'status = "active"' })

      expect(apiClient.get).toHaveBeenCalledWith('/databases/inventory/entries', {
        params: { page: 1, per_page: 20, filter: 'status = "active"' },
      })
      expect(result.filter).toBe('status = "active"')
    })

    it('does not include filter param when filter is undefined', async () => {
      const mockResponse = {
        entries: [],
        pagination: { page: 1, per_page: 20, total: 0, pages: 0 },
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockResponse })

      await getEntries('inventory', { page: 1 })

      const callArgs = vi.mocked(apiClient.get).mock.calls[0]
      expect(callArgs[1]).toEqual({ params: { page: 1, per_page: 20 } })
      expect(callArgs[1]?.params).not.toHaveProperty('filter')
    })

    it('propagates errors', async () => {
      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Server Error'))

      await expect(getEntries('inventory')).rejects.toThrow('Server Error')
    })
  })

  describe('validateFilter', () => {
    it('calls POST /databases/:slug/entries/validate-filter with filter string', async () => {
      const mockResponse = { valid: true, ast: { type: 'comparison' } }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await validateFilter('inventory', 'name = "Widget"')

      expect(apiClient.post).toHaveBeenCalledWith(
        '/databases/inventory/entries/validate-filter',
        { filter: 'name = "Widget"' }
      )
      expect(result.valid).toBe(true)
    })

    it('returns error info for invalid filters', async () => {
      const mockResponse = { valid: false, error: 'Unexpected token at position 5' }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await validateFilter('inventory', 'name ==')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Unexpected token at position 5')
    })
  })

  describe('getEntry', () => {
    it('calls GET /databases/:slug/entries/:id and returns the entry', async () => {
      const mockEntry = { id: 'e1', values: { name: 'Widget', price: 29.99 } }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockEntry })

      const result = await getEntry('inventory', 'e1')

      expect(apiClient.get).toHaveBeenCalledWith('/databases/inventory/entries/e1')
      expect(result).toEqual(mockEntry)
    })

    it('propagates 404 errors', async () => {
      const error = { response: { status: 404 } }
      vi.mocked(apiClient.get).mockRejectedValueOnce(error)

      await expect(getEntry('inventory', 'nonexistent')).rejects.toEqual(error)
    })
  })

  describe('createEntry', () => {
    it('calls POST /databases/:slug/entries with values', async () => {
      const payload = { values: { name: 'New Widget', price: 19.99 } }
      const mockResponse = {
        message: 'Entry created',
        entry: { id: 'e3', values: payload.values },
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await createEntry('inventory', payload)

      expect(apiClient.post).toHaveBeenCalledWith('/databases/inventory/entries', payload)
      expect(result.message).toBe('Entry created')
      expect(result.entry.values.name).toBe('New Widget')
    })

    it('handles complex value types', async () => {
      const payload = {
        values: {
          name: 'Complex Item',
          active: true,
          tags: ['electronics', 'sale'],
          metadata: { color: 'red' },
        },
      }
      const mockResponse = { message: 'Entry created', entry: { id: 'e4', values: payload.values } }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await createEntry('inventory', payload)

      expect(apiClient.post).toHaveBeenCalledWith('/databases/inventory/entries', payload)
      expect(result.entry.values.tags).toEqual(['electronics', 'sale'])
    })
  })

  describe('updateEntry', () => {
    it('calls PUT /databases/:slug/entries/:id with updated values', async () => {
      const payload = { values: { name: 'Updated Widget', price: 24.99 } }
      const mockResponse = {
        message: 'Entry updated',
        entry: { id: 'e1', values: payload.values },
      }
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: mockResponse })

      const result = await updateEntry('inventory', 'e1', payload)

      expect(apiClient.put).toHaveBeenCalledWith('/databases/inventory/entries/e1', payload)
      expect(result.message).toBe('Entry updated')
    })
  })

  describe('deleteEntry', () => {
    it('calls DELETE /databases/:slug/entries/:id', async () => {
      const mockResponse = { message: 'Entry deleted' }
      vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: mockResponse })

      const result = await deleteEntry('inventory', 'e1')

      expect(apiClient.delete).toHaveBeenCalledWith('/databases/inventory/entries/e1')
      expect(result).toEqual(mockResponse)
    })

    it('propagates errors on deletion failure', async () => {
      vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('Forbidden'))

      await expect(deleteEntry('inventory', 'e1')).rejects.toThrow('Forbidden')
    })
  })
})
