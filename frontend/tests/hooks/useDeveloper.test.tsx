import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('../../src/api/developer', () => ({
  getScopes: vi.fn(),
  getClients: vi.fn(),
  getClient: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
  rotateSecret: vi.fn(),
}))

import {
  getScopes,
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  rotateSecret,
} from '../../src/api/developer'
import {
  useScopes,
  useClients,
  useClient,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useRotateSecret,
} from '../../src/hooks/useDeveloper'

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

describe('useScopes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches available OAuth scopes', async () => {
    const mockScopes = [
      { name: 'databases:read', description: 'Read databases' },
      { name: 'databases:write', description: 'Write databases' },
      { name: 'entries:read', description: 'Read entries' },
    ]
    vi.mocked(getScopes).mockResolvedValueOnce(mockScopes)

    const { result } = renderHook(() => useScopes(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockScopes)
    expect(getScopes).toHaveBeenCalledOnce()
  })

  it('handles fetch error', async () => {
    vi.mocked(getScopes).mockRejectedValueOnce(new Error('Server error'))

    const { result } = renderHook(() => useScopes(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('useClients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches all OAuth clients', async () => {
    const mockClients = [
      {
        id: 'c1',
        client_id: 'client_abc123',
        name: 'My App',
        description: 'Test app',
        redirect_uris: ['http://localhost:3000/callback'],
        scopes: ['databases:read'],
        active: true,
        user_id: 'u1',
        account_id: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
    ]
    vi.mocked(getClients).mockResolvedValueOnce(mockClients)

    const { result } = renderHook(() => useClients(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockClients)
    expect(getClients).toHaveBeenCalledOnce()
  })

  it('returns empty array when no clients exist', async () => {
    vi.mocked(getClients).mockResolvedValueOnce([])

    const { result } = renderHook(() => useClients(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([])
  })
})

describe('useClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches a single OAuth client by id', async () => {
    const mockClient = {
      id: 'c1',
      client_id: 'client_abc123',
      name: 'My App',
      description: 'Test app',
      redirect_uris: ['http://localhost:3000/callback'],
      scopes: ['databases:read'],
      active: true,
      user_id: 'u1',
      account_id: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    }
    vi.mocked(getClient).mockResolvedValueOnce(mockClient)

    const { result } = renderHook(() => useClient('c1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockClient)
    expect(getClient).toHaveBeenCalledWith('c1')
  })

  it('does not fetch when clientId is empty', async () => {
    const { result } = renderHook(() => useClient(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(getClient).not.toHaveBeenCalled()
  })
})

describe('useCreateClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an OAuth client', async () => {
    const mockResponse = {
      message: 'Client created',
      client: {
        id: 'c2',
        client_id: 'client_def456',
        client_secret: 'secret_xyz789',
        name: 'New App',
        description: 'A new application',
        redirect_uris: ['http://localhost:4000/callback'],
        scopes: ['databases:read', 'entries:read'],
        active: true,
        user_id: 'u1',
        account_id: null,
        created_at: '2024-01-02',
        updated_at: '2024-01-02',
      },
    }
    vi.mocked(createClient).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useCreateClient(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({
        name: 'New App',
        description: 'A new application',
        redirect_uris: ['http://localhost:4000/callback'],
        scopes: ['databases:read', 'entries:read'],
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(createClient).toHaveBeenCalledWith({
      name: 'New App',
      description: 'A new application',
      redirect_uris: ['http://localhost:4000/callback'],
      scopes: ['databases:read', 'entries:read'],
    })
    expect(result.current.data).toEqual(mockResponse)
  })

  it('handles creation error', async () => {
    vi.mocked(createClient).mockRejectedValueOnce(new Error('Validation error'))

    const { result } = renderHook(() => useCreateClient(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({
        name: '',
        redirect_uris: [],
        scopes: [],
      })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('useUpdateClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates an OAuth client', async () => {
    const mockUpdatedClient = {
      id: 'c1',
      client_id: 'client_abc123',
      name: 'Updated App',
      description: 'Updated description',
      redirect_uris: ['http://localhost:3000/callback'],
      scopes: ['databases:read', 'databases:write'],
      active: true,
      user_id: 'u1',
      account_id: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-03',
    }
    vi.mocked(updateClient).mockResolvedValueOnce(mockUpdatedClient)

    const { result } = renderHook(() => useUpdateClient('c1'), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({
        name: 'Updated App',
        description: 'Updated description',
        scopes: ['databases:read', 'databases:write'],
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(updateClient).toHaveBeenCalledWith('c1', {
      name: 'Updated App',
      description: 'Updated description',
      scopes: ['databases:read', 'databases:write'],
    })
    expect(result.current.data).toEqual(mockUpdatedClient)
  })

  it('deactivates an OAuth client', async () => {
    const mockUpdatedClient = {
      id: 'c1',
      client_id: 'client_abc123',
      name: 'My App',
      description: 'Test app',
      redirect_uris: ['http://localhost:3000/callback'],
      scopes: ['databases:read'],
      active: false,
      user_id: 'u1',
      account_id: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-03',
    }
    vi.mocked(updateClient).mockResolvedValueOnce(mockUpdatedClient)

    const { result } = renderHook(() => useUpdateClient('c1'), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({ active: false })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(updateClient).toHaveBeenCalledWith('c1', { active: false })
    expect(result.current.data?.active).toBe(false)
  })
})

describe('useDeleteClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes an OAuth client', async () => {
    vi.mocked(deleteClient).mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useDeleteClient(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate('c1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(deleteClient).mock.calls[0][0]).toBe('c1')
  })

  it('handles deletion error', async () => {
    vi.mocked(deleteClient).mockRejectedValueOnce(new Error('Not found'))

    const { result } = renderHook(() => useDeleteClient(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate('nonexistent')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('useRotateSecret', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rotates a client secret', async () => {
    const mockClientWithSecret = {
      id: 'c1',
      client_id: 'client_abc123',
      client_secret: 'new_secret_xyz',
      name: 'My App',
      description: 'Test app',
      redirect_uris: ['http://localhost:3000/callback'],
      scopes: ['databases:read'],
      active: true,
      user_id: 'u1',
      account_id: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-04',
    }
    vi.mocked(rotateSecret).mockResolvedValueOnce(mockClientWithSecret)

    const { result } = renderHook(() => useRotateSecret(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate('c1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(rotateSecret).mock.calls[0][0]).toBe('c1')
    expect(result.current.data).toEqual(mockClientWithSecret)
    expect(result.current.data?.client_secret).toBe('new_secret_xyz')
  })

  it('handles rotation error', async () => {
    vi.mocked(rotateSecret).mockRejectedValueOnce(new Error('Client not found'))

    const { result } = renderHook(() => useRotateSecret(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate('nonexistent')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})
