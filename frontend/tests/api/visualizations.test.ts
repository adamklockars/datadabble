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
  getVisualizations,
  getVisualization,
  createVisualization,
  updateVisualization,
  deleteVisualization,
  getVisualizationData,
  getAdHocVisualizationData,
} from '../../src/api/visualizations'

describe('visualizations API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getVisualizations', () => {
    it('calls GET /visualizations and returns all visualizations', async () => {
      const mockData = [
        { id: 'v1', title: 'Sales Chart', chart_type: 'bar', database_slugs: ['sales'] },
        { id: 'v2', title: 'Revenue Trend', chart_type: 'line', database_slugs: ['revenue'] },
      ]
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockData })

      const result = await getVisualizations()

      expect(apiClient.get).toHaveBeenCalledWith('/visualizations')
      expect(result).toEqual(mockData)
      expect(result).toHaveLength(2)
    })

    it('returns empty array when no visualizations exist', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })

      const result = await getVisualizations()

      expect(result).toEqual([])
    })
  })

  describe('getVisualization', () => {
    it('calls GET /visualizations/:id and returns the visualization', async () => {
      const mockViz = {
        id: 'v1',
        title: 'Sales Chart',
        chart_type: 'bar',
        database_slugs: ['sales'],
        x_field: 'category',
        y_field: 'amount',
        aggregation: 'sum',
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockViz })

      const result = await getVisualization('v1')

      expect(apiClient.get).toHaveBeenCalledWith('/visualizations/v1')
      expect(result).toEqual(mockViz)
    })
  })

  describe('createVisualization', () => {
    it('calls POST /visualizations with full visualization data', async () => {
      const payload = {
        title: 'New Chart',
        chart_type: 'pie' as const,
        database_slugs: ['inventory'],
        x_field: 'category',
        y_field: 'count',
        aggregation: 'count' as const,
      }
      const mockResponse = {
        message: 'Visualization created',
        visualization: { id: 'v3', ...payload },
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await createVisualization(payload)

      expect(apiClient.post).toHaveBeenCalledWith('/visualizations', payload)
      expect(result.message).toBe('Visualization created')
      expect(result.visualization.chart_type).toBe('pie')
    })

    it('creates visualization without optional y_field and aggregation', async () => {
      const payload = {
        title: 'Simple Bar',
        chart_type: 'bar' as const,
        database_slugs: ['contacts'],
        x_field: 'city',
      }
      const mockResponse = {
        message: 'Visualization created',
        visualization: { id: 'v4', ...payload },
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await createVisualization(payload)

      expect(apiClient.post).toHaveBeenCalledWith('/visualizations', payload)
      expect(result.visualization.id).toBe('v4')
    })

    it('supports multiple database_slugs', async () => {
      const payload = {
        title: 'Combined Chart',
        chart_type: 'line' as const,
        database_slugs: ['sales-2024', 'sales-2025'],
        x_field: 'month',
        y_field: 'revenue',
        aggregation: 'sum' as const,
      }
      const mockResponse = {
        message: 'Visualization created',
        visualization: { id: 'v5', ...payload },
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await createVisualization(payload)

      expect(result.visualization.database_slugs).toEqual(['sales-2024', 'sales-2025'])
    })
  })

  describe('updateVisualization', () => {
    it('calls PUT /visualizations/:id with updated fields', async () => {
      const payload = { title: 'Updated Chart Title', chart_type: 'line' as const }
      const mockResponse = {
        message: 'Visualization updated',
        visualization: {
          id: 'v1',
          title: 'Updated Chart Title',
          chart_type: 'line',
          database_slugs: ['sales'],
          x_field: 'category',
        },
      }
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: mockResponse })

      const result = await updateVisualization('v1', payload)

      expect(apiClient.put).toHaveBeenCalledWith('/visualizations/v1', payload)
      expect(result.visualization.title).toBe('Updated Chart Title')
    })

    it('allows partial updates', async () => {
      const payload = { aggregation: 'count' as const }
      const mockResponse = {
        message: 'Visualization updated',
        visualization: { id: 'v1', title: 'Sales Chart', aggregation: 'count' },
      }
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: mockResponse })

      const result = await updateVisualization('v1', payload)

      expect(apiClient.put).toHaveBeenCalledWith('/visualizations/v1', payload)
      expect(result.message).toBe('Visualization updated')
    })
  })

  describe('deleteVisualization', () => {
    it('calls DELETE /visualizations/:id', async () => {
      const mockResponse = { message: 'Visualization deleted' }
      vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: mockResponse })

      const result = await deleteVisualization('v1')

      expect(apiClient.delete).toHaveBeenCalledWith('/visualizations/v1')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getVisualizationData', () => {
    it('calls GET /visualizations/:id/data and returns chart data', async () => {
      const mockData = {
        labels: ['Electronics', 'Clothing', 'Food'],
        series: [{ name: 'Sales', data: [150, 230, 90] }],
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockData })

      const result = await getVisualizationData('v1')

      expect(apiClient.get).toHaveBeenCalledWith('/visualizations/v1/data')
      expect(result.labels).toEqual(['Electronics', 'Clothing', 'Food'])
      expect(result.series[0].data).toEqual([150, 230, 90])
    })

    it('propagates errors for missing visualization', async () => {
      const error = { response: { status: 404, data: { message: 'Not found' } } }
      vi.mocked(apiClient.get).mockRejectedValueOnce(error)

      await expect(getVisualizationData('nonexistent')).rejects.toEqual(error)
    })
  })

  describe('getAdHocVisualizationData', () => {
    it('calls POST /visualizations/data with ad hoc parameters', async () => {
      const params = {
        database_slugs: ['inventory'],
        x_field: 'category',
        y_field: 'price',
        aggregation: 'sum' as const,
      }
      const mockData = {
        labels: ['A', 'B', 'C'],
        series: [{ name: 'price', data: [100, 200, 300] }],
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockData })

      const result = await getAdHocVisualizationData(params)

      expect(apiClient.post).toHaveBeenCalledWith('/visualizations/data', params)
      expect(result.labels).toEqual(['A', 'B', 'C'])
      expect(result.series).toHaveLength(1)
    })

    it('works with count aggregation and no y_field', async () => {
      const params = {
        database_slugs: ['contacts'],
        x_field: 'city',
        aggregation: 'count' as const,
      }
      const mockData = {
        labels: ['NYC', 'LA', 'Chicago'],
        series: [{ name: 'count', data: [45, 32, 28] }],
      }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockData })

      const result = await getAdHocVisualizationData(params)

      expect(apiClient.post).toHaveBeenCalledWith('/visualizations/data', params)
      expect(result.series[0].name).toBe('count')
    })
  })
})
