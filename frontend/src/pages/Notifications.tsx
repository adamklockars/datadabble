import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '../hooks/useNotifications'
import { deleteNotification } from '../api/notifications'
import { useQueryClient } from '@tanstack/react-query'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

export default function Notifications() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useNotifications({ page, per_page: 20, unread_only: unreadOnly })
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()

  const handleClick = (notification: { id: string; read: boolean; link: string | null }) => {
    if (!notification.read) {
      markAsRead.mutate(notification.id)
    }
    if (notification.link) {
      navigate(notification.link)
    }
  }

  const handleDelete = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    await deleteNotification(notificationId)
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
        <div className="flex items-center gap-3">
          <div className="flex bg-dark-700 rounded-md overflow-hidden">
            <button
              onClick={() => { setUnreadOnly(false); setPage(1) }}
              className={`px-4 py-2 text-sm transition-colors ${
                !unreadOnly ? 'bg-dark-500 text-white' : 'text-dark-100 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => { setUnreadOnly(true); setPage(1) }}
              className={`px-4 py-2 text-sm transition-colors ${
                unreadOnly ? 'bg-dark-500 text-white' : 'text-dark-100 hover:text-white'
              }`}
            >
              Unread {data?.unread_count ? `(${data.unread_count})` : ''}
            </button>
          </div>
          {data && data.unread_count > 0 && (
            <Button variant="secondary" size="sm" onClick={() => markAllAsRead.mutate()}>
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="space-y-2">
            {data?.notifications.length === 0 ? (
              <div className="bg-dark-700 rounded-lg px-6 py-12 text-center text-dark-100">
                {unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}
              </div>
            ) : (
              data?.notifications.map(notification => (
                <div
                  key={notification.id}
                  onClick={() => handleClick(notification)}
                  className={`bg-dark-700 rounded-lg px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-dark-600 transition-colors ${
                    !notification.read ? 'border-l-2 border-accent' : ''
                  }`}
                >
                  {!notification.read && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-accent flex-shrink-0" />
                  )}
                  <div className={`flex-1 min-w-0 ${notification.read ? 'ml-5' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-white font-medium">{notification.title}</p>
                        {notification.message && (
                          <p className="text-sm text-dark-100 mt-0.5">{notification.message}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-dark-200">{formatDate(notification.created_at)}</span>
                        <button
                          onClick={(e) => handleDelete(e, notification.id)}
                          className="text-dark-200 hover:text-red-400 transition-colors"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {notification.actor_email && (
                      <p className="text-xs text-dark-200 mt-1">by {notification.actor_email}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {data && data.pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-dark-100">
                Page {data.pagination.page} of {data.pagination.pages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= data.pagination.pages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
