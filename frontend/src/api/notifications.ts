import { apiClient } from './client'
import type { Pagination } from '../types'
import type { Notification, NotificationPreferences } from '../types/notifications'

export interface NotificationFilters {
  page?: number
  per_page?: number
  unread_only?: boolean
}

export async function getNotifications(filters: NotificationFilters = {}): Promise<{
  notifications: Notification[]
  pagination: Pagination
  unread_count: number
}> {
  const params = new URLSearchParams()
  if (filters.page) params.append('page', String(filters.page))
  if (filters.per_page) params.append('per_page', String(filters.per_page))
  if (filters.unread_only) params.append('unread_only', 'true')
  const { data } = await apiClient.get(`/notifications?${params.toString()}`)
  return data
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await apiClient.get('/notifications/unread-count')
  return data.unread_count
}

export async function markAsRead(notificationId: string): Promise<Notification> {
  const { data } = await apiClient.put(`/notifications/${notificationId}/read`)
  return data.notification
}

export async function markAllAsRead(): Promise<void> {
  await apiClient.put('/notifications/read-all')
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await apiClient.delete(`/notifications/${notificationId}`)
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await apiClient.get('/notifications/preferences')
  return data.preferences
}

export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const { data } = await apiClient.put('/notifications/preferences', preferences)
  return data.preferences
}
