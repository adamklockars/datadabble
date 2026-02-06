import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('../../src/api/databases', () => ({
  getDatabases: vi.fn(),
  getDatabase: vi.fn(),
  createDatabase: vi.fn(),
  updateDatabase: vi.fn(),
  deleteDatabase: vi.fn(),
}))

import {
  getDatabases,
  getDatabase,
  createDatabase,
  updateDatabase,
  deleteDatabase,
} from '../../src/api/databases'
import {
  useDatabases,
  useDatabase,
  useCreateDatabase,
  useUpdateDatabase,
  useDeleteDatabase,
} from '../../src/hooks/useDatabases'

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

describe('useDatabases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches databases successfully', async () => {
    const mockData = [
      { id: '1', title: 'Test DB', slug: 'test-db', description: '' },
      { id: '2', title: 'Another DB', slug: 'another-db', description: 'desc' },
    ]
    vi.mocked(getDatabases).mockResolvedValueOnce(mockData)

    const { result } = renderHook(() => useDatabases(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(getDatabases).toHaveBeenCalledOnce()
  })

  it('handles fetch error', async () => {
    vi.mocked(getDatabases).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useDatabases(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('useDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches a single database by slug', async () => {
    const mockDatabase = { id: '1', title: 'Test DB', slug: 'test-db', description: '' }
    vi.mocked(getDatabase).mockResolvedValueOnce(mockDatabase)

    const { result } = renderHook(() => useDatabase('test-db'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockDatabase)
    expect(getDatabase).toHaveBeenCalledWith('test-db')
  })

  it('does not fetch when slug is empty', async () => {
    const { result } = renderHook(() => useDatabase(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(getDatabase).not.toHaveBeenCalled()
  })
})

describe('useCreateDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a database and invalidates queries', async () => {
    const mockResponse = {
      message: 'Database created',
      database: { id: '3', title: 'New DB', slug: 'new-db', description: '' },
    }
    vi.mocked(createDatabase).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useCreateDatabase(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({ title: 'New DB' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(createDatabase).mock.calls[0][0]).toEqual({ title: 'New DB' })
    expect(result.current.data).toEqual(mockResponse)
  })

  it('handles creation error', async () => {
    vi.mocked(createDatabase).mockRejectedValueOnce(new Error('Validation error'))

    const { result } = renderHook(() => useCreateDatabase(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({ title: '' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('useUpdateDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates a database', async () => {
    const mockResponse = {
      message: 'Database updated',
      database: { id: '1', title: 'Updated DB', slug: 'test-db', description: 'new desc' },
    }
    vi.mocked(updateDatabase).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useUpdateDatabase('test-db'), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({ title: 'Updated DB', description: 'new desc' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(updateDatabase).toHaveBeenCalledWith('test-db', {
      title: 'Updated DB',
      description: 'new desc',
    })
    expect(result.current.data).toEqual(mockResponse)
  })
})

describe('useDeleteDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes a database', async () => {
    const mockResponse = { message: 'Database deleted' }
    vi.mocked(deleteDatabase).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useDeleteDatabase(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate('test-db')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(deleteDatabase).mock.calls[0][0]).toBe('test-db')
    expect(result.current.data).toEqual(mockResponse)
  })

  it('handles deletion error', async () => {
    vi.mocked(deleteDatabase).mockRejectedValueOnce(new Error('Not found'))

    const { result } = renderHook(() => useDeleteDatabase(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate('nonexistent')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})
