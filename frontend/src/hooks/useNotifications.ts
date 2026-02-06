import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../api/notifications'
import type { NotificationFilters } from '../api/notifications'
import type { NotificationPreferences } from '../types/notifications'

export function useNotifications(filters: NotificationFilters = {}) {
  return useQuery({
    queryKey: ['notifications', filters],
    queryFn: () => getNotifications(filters),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['unreadCount'],
    queryFn: getUnreadCount,
    refetchInterval: 30000, // Poll every 30 seconds
  })
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
    },
  })
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
    },
  })
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: getNotificationPreferences,
  })
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (prefs: Partial<NotificationPreferences>) => updateNotificationPreferences(prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] })
    },
  })
}
