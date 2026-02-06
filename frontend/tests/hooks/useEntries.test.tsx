import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('../../src/api/entries', () => ({
  getEntries: vi.fn(),
  createEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
}))

import { getEntries, createEntry, updateEntry, deleteEntry } from '../../src/api/entries'
import {
  useEntries,
  useCreateEntry,
  useUpdateEntry,
  useDeleteEntry,
} from '../../src/hooks/useEntries'

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

describe('useEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches entries with default pagination', async () => {
    const mockResponse = {
      entries: [
        { id: 'e1', values: { Name: 'Alice', Age: 30 }, created_at: '2024-01-01' },
        { id: 'e2', values: { Name: 'Bob', Age: 25 }, created_at: '2024-01-02' },
      ],
      pagination: { page: 1, per_page: 20, total: 2, pages: 1 },
      filter: null,
    }
    vi.mocked(getEntries).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useEntries('test-db'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockResponse)
    expect(getEntries).toHaveBeenCalledWith('test-db', { page: 1, perPage: 20, filter: '' })
  })

  it('fetches entries with custom pagination and filter', async () => {
    const mockResponse = {
      entries: [{ id: 'e1', values: { Name: 'Alice' }, created_at: '2024-01-01' }],
      pagination: { page: 2, per_page: 10, total: 11, pages: 2 },
      filter: 'Name = "Alice"',
    }
    vi.mocked(getEntries).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useEntries('test-db', 2, 10, 'Name = "Alice"'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(getEntries).toHaveBeenCalledWith('test-db', {
      page: 2,
      perPage: 10,
      filter: 'Name = "Alice"',
    })
  })

  it('does not fetch when databaseSlug is empty', async () => {
    const { result } = renderHook(() => useEntries(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(getEntries).not.toHaveBeenCalled()
  })

  it('handles fetch error', async () => {
    vi.mocked(getEntries).mockRejectedValueOnce(new Error('Server error'))

    const { result } = renderHook(() => useEntries('test-db'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('useCreateEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an entry successfully', async () => {
    const mockResponse = {
      message: 'Entry created',
      entry: { id: 'e3', values: { Name: 'Charlie', Age: 35 }, created_at: '2024-01-03' },
    }
    vi.mocked(createEntry).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useCreateEntry('test-db'), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({ values: { Name: 'Charlie', Age: 35 } })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(createEntry).toHaveBeenCalledWith('test-db', {
      values: { Name: 'Charlie', Age: 35 },
    })
    expect(result.current.data).toEqual(mockResponse)
  })

  it('handles creation error', async () => {
    vi.mocked(createEntry).mockRejectedValueOnce(new Error('Validation failed'))

    const { result } = renderHook(() => useCreateEntry('test-db'), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({ values: {} })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('useUpdateEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates an entry successfully', async () => {
    const mockResponse = {
      message: 'Entry updated',
      entry: { id: 'e1', values: { Name: 'Alice Updated', Age: 31 }, created_at: '2024-01-01' },
    }
    vi.mocked(updateEntry).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useUpdateEntry('test-db'), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({
        entryId: 'e1',
        data: { values: { Name: 'Alice Updated', Age: 31 } },
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(updateEntry).toHaveBeenCalledWith('test-db', 'e1', {
      values: { Name: 'Alice Updated', Age: 31 },
    })
    expect(result.current.data).toEqual(mockResponse)
  })
})

describe('useDeleteEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes an entry successfully', async () => {
    const mockResponse = { message: 'Entry deleted' }
    vi.mocked(deleteEntry).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useDeleteEntry('test-db'), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate('e1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(deleteEntry).toHaveBeenCalledWith('test-db', 'e1')
    expect(result.current.data).toEqual(mockResponse)
  })

  it('handles deletion error', async () => {
    vi.mocked(deleteEntry).mockRejectedValueOnce(new Error('Not found'))

    const { result } = renderHook(() => useDeleteEntry('test-db'), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate('nonexistent')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})
