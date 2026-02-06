import { describe, it, expect, vi, beforeEach } from 'vitest'

// notifications.ts uses named import { apiClient } instead of default import
vi.mock('../../src/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import { apiClient } from '../../src/api/client'
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../../src/api/notifications'

describe('notifications API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getNotifications', () => {
    it('calls GET /notifications with no filters by default', async () => {
      const mockResponse = {
        notifications: [
          { id: 'n1', title: 'Welcome', message: 'Welcome to DataDabble', read: false },
        ],
        pagination: { page: 1, per_page: 20, total: 1, pages: 1 },
        unread_count: 1,
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await getNotifications()

      expect(apiClient.get).toHaveBeenCalledTimes(1)
      const callUrl = vi.mocked(apiClient.get).mock.calls[0][0]
      expect(callUrl).toContain('/notifications')
      expect(result).toEqual(mockResponse)
    })

    it('passes page and per_page as query params', async () => {
      const mockResponse = {
        notifications: [],
        pagination: { page: 2, per_page: 10, total: 15, pages: 2 },
        unread_count: 3,
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await getNotifications({ page: 2, per_page: 10 })

      const callUrl = vi.mocked(apiClient.get).mock.calls[0][0] as string
      expect(callUrl).toContain('page=2')
      expect(callUrl).toContain('per_page=10')
      expect(result.pagination.page).toBe(2)
    })

    it('passes unread_only filter', async () => {
      const mockResponse = {
        notifications: [{ id: 'n2', title: 'Alert', read: false }],
        pagination: { page: 1, per_page: 20, total: 1, pages: 1 },
        unread_count: 1,
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockResponse })

      await getNotifications({ unread_only: true })

      const callUrl = vi.mocked(apiClient.get).mock.calls[0][0] as string
      expect(callUrl).toContain('unread_only=true')
    })

    it('does not include falsy filter values in query params', async () => {
      const mockResponse = {
        notifications: [],
        pagination: { page: 1, per_page: 20, total: 0, pages: 0 },
        unread_count: 0,
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockResponse })

      await getNotifications({ page: 0, unread_only: false })

      const callUrl = vi.mocked(apiClient.get).mock.calls[0][0] as string
      expect(callUrl).not.toContain('page=')
      expect(callUrl).not.toContain('unread_only=')
    })
  })

  describe('getUnreadCount', () => {
    it('calls GET /notifications/unread-count and returns the count', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { unread_count: 7 } })

      const result = await getUnreadCount()

      expect(apiClient.get).toHaveBeenCalledWith('/notifications/unread-count')
      expect(result).toBe(7)
    })

    it('returns 0 when no unread notifications', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { unread_count: 0 } })

      const result = await getUnreadCount()

      expect(result).toBe(0)
    })
  })

  describe('markAsRead', () => {
    it('calls PUT /notifications/:id/read and returns updated notification', async () => {
      const mockNotification = { id: 'n1', title: 'Welcome', read: true }
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { notification: mockNotification } })

      const result = await markAsRead('n1')

      expect(apiClient.put).toHaveBeenCalledWith('/notifications/n1/read')
      expect(result).toEqual(mockNotification)
      expect(result.read).toBe(true)
    })
  })

  describe('markAllAsRead', () => {
    it('calls PUT /notifications/read-all', async () => {
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: {} })

      await markAllAsRead()

      expect(apiClient.put).toHaveBeenCalledWith('/notifications/read-all')
    })

    it('does not return a value', async () => {
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: {} })

      const result = await markAllAsRead()

      expect(result).toBeUndefined()
    })
  })

  describe('deleteNotification', () => {
    it('calls DELETE /notifications/:id', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: {} })

      await deleteNotification('n1')

      expect(apiClient.delete).toHaveBeenCalledWith('/notifications/n1')
    })

    it('does not return a value', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: {} })

      const result = await deleteNotification('n1')

      expect(result).toBeUndefined()
    })

    it('propagates errors', async () => {
      vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('Not found'))

      await expect(deleteNotification('nonexistent')).rejects.toThrow('Not found')
    })
  })

  describe('getNotificationPreferences', () => {
    it('calls GET /notifications/preferences and returns preferences', async () => {
      const mockPrefs = {
        email_enabled: true,
        push_enabled: false,
        digest_frequency: 'daily',
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { preferences: mockPrefs } })

      const result = await getNotificationPreferences()

      expect(apiClient.get).toHaveBeenCalledWith('/notifications/preferences')
      expect(result).toEqual(mockPrefs)
    })
  })

  describe('updateNotificationPreferences', () => {
    it('calls PUT /notifications/preferences with partial preferences', async () => {
      const updates = { email_enabled: false }
      const mockPrefs = {
        email_enabled: false,
        push_enabled: true,
        digest_frequency: 'daily',
      }
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { preferences: mockPrefs } })

      const result = await updateNotificationPreferences(updates)

      expect(apiClient.put).toHaveBeenCalledWith('/notifications/preferences', updates)
      expect(result.email_enabled).toBe(false)
    })

    it('updates multiple preferences at once', async () => {
      const updates = { email_enabled: true, push_enabled: true, digest_frequency: 'weekly' }
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { preferences: updates } })

      const result = await updateNotificationPreferences(updates)

      expect(apiClient.put).toHaveBeenCalledWith('/notifications/preferences', updates)
      expect(result).toEqual(updates)
    })
  })
})
