import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('../../src/api/notifications', () => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}))

import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../../src/api/notifications'
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../../src/hooks/useNotifications'

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

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches notifications with default filters', async () => {
    const mockResponse = {
      notifications: [
        {
          id: 'n1',
          title: 'New entry added',
          message: 'An entry was added to your database',
          notification_type: 'entry_modifications',
          read: false,
          created_at: '2024-01-01T00:00:00Z',
          read_at: null,
          link: null,
          actor_email: null,
          database_slug: null,
          resource_type: null,
          resource_id: null,
        },
      ],
      pagination: { page: 1, per_page: 20, total: 1, pages: 1 },
      unread_count: 1,
    }
    vi.mocked(getNotifications).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockResponse)
    expect(getNotifications).toHaveBeenCalledWith({})
  })

  it('fetches notifications with custom filters', async () => {
    const mockResponse = {
      notifications: [],
      pagination: { page: 2, per_page: 10, total: 15, pages: 2 },
      unread_count: 0,
    }
    vi.mocked(getNotifications).mockResolvedValueOnce(mockResponse)

    const filters = { page: 2, per_page: 10, unread_only: true }
    const { result } = renderHook(() => useNotifications(filters), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(getNotifications).toHaveBeenCalledWith(filters)
  })

  it('handles fetch error', async () => {
    vi.mocked(getNotifications).mockRejectedValueOnce(new Error('Server error'))

    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('useUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches unread notification count', async () => {
    vi.mocked(getUnreadCount).mockResolvedValueOnce(5)

    const { result } = renderHook(() => useUnreadCount(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(5)
    expect(getUnreadCount).toHaveBeenCalledOnce()
  })

  it('returns zero when no unread notifications', async () => {
    vi.mocked(getUnreadCount).mockResolvedValueOnce(0)

    const { result } = renderHook(() => useUnreadCount(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(0)
  })
})

describe('useMarkAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks a notification as read', async () => {
    const mockNotification = {
      id: 'n1',
      title: 'Test',
      message: null,
      notification_type: 'entry_modifications',
      read: true,
      created_at: '2024-01-01T00:00:00Z',
      read_at: '2024-01-02T00:00:00Z',
      link: null,
      actor_email: null,
      database_slug: null,
      resource_type: null,
      resource_id: null,
    }
    vi.mocked(markAsRead).mockResolvedValueOnce(mockNotification)

    const { result } = renderHook(() => useMarkAsRead(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate('n1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(markAsRead).mock.calls[0][0]).toBe('n1')
    expect(result.current.data).toEqual(mockNotification)
  })
})

describe('useMarkAllAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks all notifications as read', async () => {
    vi.mocked(markAllAsRead).mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useMarkAllAsRead(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate(undefined as void)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(markAllAsRead).toHaveBeenCalledOnce()
  })
})

describe('useNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches notification preferences', async () => {
    const mockPrefs = {
      email_enabled: true,
      team_invites: { in_app: true, email: true },
      database_changes: { in_app: true, email: false },
      entry_modifications: { in_app: true, email: false },
      field_changes: { in_app: true, email: false },
      weekly_digest: true,
    }
    vi.mocked(getNotificationPreferences).mockResolvedValueOnce(mockPrefs)

    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockPrefs)
    expect(getNotificationPreferences).toHaveBeenCalledOnce()
  })
})

describe('useUpdateNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates notification preferences', async () => {
    const updatedPrefs = {
      email_enabled: false,
      team_invites: { in_app: true, email: false },
      database_changes: { in_app: true, email: false },
      entry_modifications: { in_app: true, email: false },
      field_changes: { in_app: true, email: false },
      weekly_digest: false,
    }
    vi.mocked(updateNotificationPreferences).mockResolvedValueOnce(updatedPrefs)

    const { result } = renderHook(() => useUpdateNotificationPreferences(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({ email_enabled: false, weekly_digest: false })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(updateNotificationPreferences).toHaveBeenCalledWith({
      email_enabled: false,
      weekly_digest: false,
    })
    expect(result.current.data).toEqual(updatedPrefs)
  })

  it('handles update error', async () => {
    vi.mocked(updateNotificationPreferences).mockRejectedValueOnce(new Error('Server error'))

    const { result } = renderHook(() => useUpdateNotificationPreferences(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate({ email_enabled: false })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})
