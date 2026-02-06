import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUnreadCount, useNotifications, useMarkAsRead, useMarkAllAsRead } from '../hooks/useNotifications'

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data: unreadCount = 0 } = useUnreadCount()
  const { data } = useNotifications({ per_page: 8 })
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNotificationClick = (notification: { id: string; read: boolean; link: string | null }) => {
    if (!notification.read) {
      markAsRead.mutate(notification.id)
    }
    setOpen(false)
    if (notification.link) {
      navigate(notification.link)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative text-dark-100 hover:text-white transition-colors p-1"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-accent text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-dark-700 border border-dark-400 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-400">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead.mutate()}
                  className="text-xs text-accent hover:text-accent-light transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {data?.notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-dark-100 text-sm">
                No notifications
              </div>
            ) : (
              data?.notifications.map(notification => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left px-4 py-3 border-b border-dark-600 hover:bg-dark-600 transition-colors ${
                    !notification.read ? 'bg-dark-600/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!notification.read && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-accent flex-shrink-0" />
                    )}
                    <div className={!notification.read ? '' : 'ml-4'}>
                      <p className="text-sm text-white font-medium">{notification.title}</p>
                      {notification.message && (
                        <p className="text-xs text-dark-100 mt-0.5 line-clamp-2">{notification.message}</p>
                      )}
                      <p className="text-xs text-dark-200 mt-1">{formatTimeAgo(notification.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="px-4 py-2 border-t border-dark-400">
            <button
              onClick={() => { setOpen(false); navigate('/notifications') }}
              className="text-xs text-accent hover:text-accent-light transition-colors w-full text-center"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
