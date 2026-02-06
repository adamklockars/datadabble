import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('../../src/api/fields', () => ({
  getFields: vi.fn(),
  createField: vi.fn(),
  updateField: vi.fn(),
  deleteField: vi.fn(),
}))

import { getFields, createField, updateField, deleteField } from '../../src/api/fields'
import { useFields, useCreateField, useUpdateField, useDeleteField } from '../../src/hooks/useFields'

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

describe('useFields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches fields for a database', async () => {
    const mockFields = [
      { id: 'f1', name: 'Name', field_type: 'STR', required: true, order: 0 },
      { id: 'f2', name: 'Age', field_type: 'INT', required: false, order: 1 },
    ]
    vi.mocked(getFields).mockResolvedValueOnce(mockFields)

    const { result } = renderHook(() => useFields('test-db'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockFields)
    expect(getFields).toHaveBeenCalledWith('test-db')
  })

  it('does not fetch when databaseSlug is empty', async () => {
    const { result } = renderHook(() => useFields(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(getFields).not.toHaveBeenCalled()
  })

  it('handles fetch error', async () => {
    vi.mocked(getFields).mockRejectedValueOnce(new Error('Server error'))

    const { result } = renderHook(() => useFields('test-db'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('useCreateField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a field successfully', async () => {
    const mockResponse = {
      message: 'Field created',
      field: { id: 'f3', name: 'Email', field_type: 'EMAIL', required: true, order: 2 },
    }
    vi.mocked(createField).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useCreateField('test-db'), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({ name: 'Email', field_type: 'EMAIL' as const, required: true })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(createField).toHaveBeenCalledWith('test-db', {
      name: 'Email',
      field_type: 'EMAIL',
      required: true,
    })
    expect(result.current.data).toEqual(mockResponse)
  })

  it('handles creation error', async () => {
    vi.mocked(createField).mockRejectedValueOnce(new Error('Duplicate field name'))

    const { result } = renderHook(() => useCreateField('test-db'), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({ name: 'Name', field_type: 'STR' as const })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('useUpdateField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates a field successfully', async () => {
    const mockResponse = {
      message: 'Field updated',
      field: { id: 'f1', name: 'Full Name', field_type: 'STR', required: true, order: 0 },
    }
    vi.mocked(updateField).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useUpdateField('test-db'), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({ fieldId: 'f1', data: { name: 'Full Name' } })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(updateField).toHaveBeenCalledWith('test-db', 'f1', { name: 'Full Name' })
    expect(result.current.data).toEqual(mockResponse)
  })
})

describe('useDeleteField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes a field successfully', async () => {
    const mockResponse = { message: 'Field deleted' }
    vi.mocked(deleteField).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useDeleteField('test-db'), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate('f1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(deleteField).toHaveBeenCalledWith('test-db', 'f1')
    expect(result.current.data).toEqual(mockResponse)
  })

  it('handles deletion error', async () => {
    vi.mocked(deleteField).mockRejectedValueOnce(new Error('Not found'))

    const { result } = renderHook(() => useDeleteField('test-db'), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate('nonexistent')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})
