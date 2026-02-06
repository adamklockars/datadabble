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
  getFields,
  getField,
  createField,
  updateField,
  deleteField,
  previewTypeChange,
  reorderFields,
} from '../../src/api/fields'

describe('fields API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getFields', () => {
    it('calls GET /databases/:slug/fields and returns field list', async () => {
      const mockFields = [
        { id: 'f1', name: 'Name', field_type: 'STR', required: true, order: 0 },
        { id: 'f2', name: 'Price', field_type: 'DEC', required: false, order: 1 },
      ]
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockFields })

      const result = await getFields('inventory')

      expect(apiClient.get).toHaveBeenCalledWith('/databases/inventory/fields')
      expect(result).toEqual(mockFields)
      expect(result).toHaveLength(2)
    })

    it('returns empty array when no fields exist', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })

      const result = await getFields('empty-db')

      expect(result).toEqual([])
    })
  })

  describe('getField', () => {
    it('calls GET /databases/:slug/fields/:id and returns single field', async () => {
      const mockField = { id: 'f1', name: 'Name', field_type: 'STR', required: true, order: 0 }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockField })

      const result = await getField('inventory', 'f1')

      expect(apiClient.get).toHaveBeenCalledWith('/databases/inventory/fields/f1')
      expect(result).toEqual(mockField)
    })
  })

  describe('createField', () => {
    it('calls POST /databases/:slug/fields with field data', async () => {
      const payload = { name: 'Email', field_type: 'EMAIL' as const, required: true }
      const mockResponse = {
        message: 'Field created',
        field: { id: 'f3', name: 'Email', field_type: 'EMAIL', required: true, order: 2 },
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await createField('inventory', payload)

      expect(apiClient.post).toHaveBeenCalledWith('/databases/inventory/fields', payload)
      expect(result.message).toBe('Field created')
      expect(result.field.name).toBe('Email')
    })

    it('creates field with default_value and order', async () => {
      const payload = {
        name: 'Status',
        field_type: 'STR' as const,
        required: false,
        default_value: 'active',
        order: 5,
      }
      const mockResponse = {
        message: 'Field created',
        field: { id: 'f4', ...payload },
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await createField('inventory', payload)

      expect(apiClient.post).toHaveBeenCalledWith('/databases/inventory/fields', payload)
      expect(result.field.default_value).toBe('active')
    })

    it('propagates validation errors', async () => {
      const error = { response: { status: 400, data: { message: 'Field name already exists' } } }
      vi.mocked(apiClient.post).mockRejectedValueOnce(error)

      await expect(
        createField('inventory', { name: 'Name', field_type: 'STR' as const })
      ).rejects.toEqual(error)
    })
  })

  describe('updateField', () => {
    it('calls PUT /databases/:slug/fields/:id with updated data', async () => {
      const payload = { name: 'Full Name', required: false }
      const mockResponse = {
        message: 'Field updated',
        field: { id: 'f1', name: 'Full Name', field_type: 'STR', required: false, order: 0 },
      }
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: mockResponse })

      const result = await updateField('inventory', 'f1', payload)

      expect(apiClient.put).toHaveBeenCalledWith('/databases/inventory/fields/f1', payload)
      expect(result.field.name).toBe('Full Name')
    })

    it('sends confirm_data_loss flag for type changes', async () => {
      const payload = { field_type: 'INT' as const, confirm_data_loss: true }
      const mockResponse = {
        message: 'Field updated',
        field: { id: 'f1', name: 'Name', field_type: 'INT', required: true, order: 0 },
      }
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: mockResponse })

      const result = await updateField('inventory', 'f1', payload)

      expect(apiClient.put).toHaveBeenCalledWith('/databases/inventory/fields/f1', payload)
      expect(result.field.field_type).toBe('INT')
    })
  })

  describe('deleteField', () => {
    it('calls DELETE /databases/:slug/fields/:id', async () => {
      const mockResponse = { message: 'Field deleted' }
      vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: mockResponse })

      const result = await deleteField('inventory', 'f1')

      expect(apiClient.delete).toHaveBeenCalledWith('/databases/inventory/fields/f1')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('previewTypeChange', () => {
    it('calls POST /databases/:slug/fields/:id/preview-type-change with new type', async () => {
      const mockAnalysis = {
        total_entries: 50,
        entries_with_value: 45,
        convertible: 40,
        will_lose_data: 5,
        affected_entries: [
          { entry_id: 'e1', current_value: 'not-a-number' },
          { entry_id: 'e2', current_value: 'also-not-a-number' },
        ],
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockAnalysis })

      const result = await previewTypeChange('inventory', 'f1', 'INT')

      expect(apiClient.post).toHaveBeenCalledWith(
        '/databases/inventory/fields/f1/preview-type-change',
        { field_type: 'INT' }
      )
      expect(result.will_lose_data).toBe(5)
      expect(result.affected_entries).toHaveLength(2)
    })

    it('returns zero data loss for compatible type changes', async () => {
      const mockAnalysis = {
        total_entries: 10,
        entries_with_value: 10,
        convertible: 10,
        will_lose_data: 0,
        affected_entries: [],
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockAnalysis })

      const result = await previewTypeChange('inventory', 'f1', 'STR')

      expect(result.will_lose_data).toBe(0)
      expect(result.affected_entries).toEqual([])
    })
  })

  describe('reorderFields', () => {
    it('calls POST /databases/:slug/fields/reorder with field IDs', async () => {
      const fieldIds = ['f2', 'f1', 'f3']
      const mockResponse = {
        message: 'Fields reordered',
        fields: [
          { id: 'f2', name: 'Price', field_type: 'DEC', order: 0 },
          { id: 'f1', name: 'Name', field_type: 'STR', order: 1 },
          { id: 'f3', name: 'Email', field_type: 'EMAIL', order: 2 },
        ],
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await reorderFields('inventory', fieldIds)

      expect(apiClient.post).toHaveBeenCalledWith(
        '/databases/inventory/fields/reorder',
        { field_ids: fieldIds }
      )
      expect(result.fields[0].id).toBe('f2')
      expect(result.fields[0].order).toBe(0)
    })
  })
})
