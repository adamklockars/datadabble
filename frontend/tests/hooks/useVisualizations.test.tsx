import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('../../src/api/visualizations', () => ({
  getVisualizations: vi.fn(),
  getVisualization: vi.fn(),
  createVisualization: vi.fn(),
  updateVisualization: vi.fn(),
  deleteVisualization: vi.fn(),
  getVisualizationData: vi.fn(),
  getAdHocVisualizationData: vi.fn(),
}))

import {
  getVisualizations,
  getVisualization,
  createVisualization,
  updateVisualization,
  deleteVisualization,
  getVisualizationData,
  getAdHocVisualizationData,
} from '../../src/api/visualizations'
import {
  useVisualizations,
  useVisualization,
  useVisualizationData,
  useCreateVisualization,
  useUpdateVisualization,
  useDeleteVisualization,
  useAdHocVisualizationData,
} from '../../src/hooks/useVisualizations'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useVisualizations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches all visualizations', async () => {
    const mockData = [
      { id: 'v1', title: 'Chart 1', chart_type: 'bar' },
      { id: 'v2', title: 'Chart 2', chart_type: 'line' },
    ]
    vi.mocked(getVisualizations).mockResolvedValueOnce(mockData)

    const { result } = renderHook(() => useVisualizations(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(getVisualizations).toHaveBeenCalledOnce()
  })

  it('handles fetch error', async () => {
    vi.mocked(getVisualizations).mockRejectedValueOnce(new Error('Server error'))

    const { result } = renderHook(() => useVisualizations(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('useVisualization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches a single visualization by id', async () => {
    const mockViz = { id: 'v1', title: 'Chart 1', chart_type: 'bar' }
    vi.mocked(getVisualization).mockResolvedValueOnce(mockViz)

    const { result } = renderHook(() => useVisualization('v1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockViz)
    expect(getVisualization).toHaveBeenCalledWith('v1')
  })

  it('does not fetch when id is undefined', async () => {
    const { result } = renderHook(() => useVisualization(undefined), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(getVisualization).not.toHaveBeenCalled()
  })
})

describe('useVisualizationData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches visualization data by id', async () => {
    const mockData = {
      labels: ['Jan', 'Feb', 'Mar'],
      series: [{ name: 'Sales', data: [10, 20, 30] }],
    }
    vi.mocked(getVisualizationData).mockResolvedValueOnce(mockData)

    const { result } = renderHook(() => useVisualizationData('v1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(getVisualizationData).toHaveBeenCalledWith('v1')
  })

  it('does not fetch when id is undefined', async () => {
    const { result } = renderHook(() => useVisualizationData(undefined), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(getVisualizationData).not.toHaveBeenCalled()
  })
})

describe('useCreateVisualization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a visualization successfully', async () => {
    const mockResponse = {
      message: 'Visualization created',
      visualization: { id: 'v3', title: 'New Chart', chart_type: 'pie' },
    }
    vi.mocked(createVisualization).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useCreateVisualization(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({
        title: 'New Chart',
        chart_type: 'pie',
        database_slugs: ['test-db'],
        x_field: 'Category',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(createVisualization).mock.calls[0][0]).toEqual({
      title: 'New Chart',
      chart_type: 'pie',
      database_slugs: ['test-db'],
      x_field: 'Category',
    })
    expect(result.current.data).toEqual(mockResponse)
  })

  it('handles creation error', async () => {
    vi.mocked(createVisualization).mockRejectedValueOnce(new Error('Validation error'))

    const { result } = renderHook(() => useCreateVisualization(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({
        title: '',
        chart_type: 'bar',
        database_slugs: [],
        x_field: '',
      })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('useUpdateVisualization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates a visualization', async () => {
    const mockResponse = {
      message: 'Visualization updated',
      visualization: { id: 'v1', title: 'Updated Chart', chart_type: 'line' },
    }
    vi.mocked(updateVisualization).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useUpdateVisualization('v1'), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({ title: 'Updated Chart', chart_type: 'line' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(updateVisualization).toHaveBeenCalledWith('v1', {
      title: 'Updated Chart',
      chart_type: 'line',
    })
    expect(result.current.data).toEqual(mockResponse)
  })
})

describe('useDeleteVisualization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes a visualization', async () => {
    const mockResponse = { message: 'Visualization deleted' }
    vi.mocked(deleteVisualization).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useDeleteVisualization(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate('v1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(deleteVisualization).mock.calls[0][0]).toBe('v1')
    expect(result.current.data).toEqual(mockResponse)
  })

  it('handles deletion error', async () => {
    vi.mocked(deleteVisualization).mockRejectedValueOnce(new Error('Not found'))

    const { result } = renderHook(() => useDeleteVisualization(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate('nonexistent')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('useAdHocVisualizationData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches ad-hoc visualization data', async () => {
    const mockData = {
      labels: ['A', 'B', 'C'],
      series: [{ name: 'Count', data: [5, 10, 15] }],
    }
    vi.mocked(getAdHocVisualizationData).mockResolvedValueOnce(mockData)

    const { result } = renderHook(() => useAdHocVisualizationData(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({
        database_slugs: ['test-db'],
        x_field: 'Category',
        aggregation: 'count',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(getAdHocVisualizationData).mock.calls[0][0]).toEqual({
      database_slugs: ['test-db'],
      x_field: 'Category',
      aggregation: 'count',
    })
    expect(result.current.data).toEqual(mockData)
  })
})
