import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getDatabases } from '../api'

export default function Sidebar() {
  const location = useLocation()
  const { data: databases = [] } = useQuery({
    queryKey: ['databases'],
    queryFn: getDatabases,
  })

  return (
    <aside className="w-64 bg-dark-900 border-r border-dark-400 min-h-screen">
      <nav className="p-4">
        <div className="mb-6">
          <Link
            to="/dashboard"
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              location.pathname === '/dashboard'
                ? 'bg-dark-500 text-accent'
                : 'text-dark-100 hover:text-white hover:bg-dark-600'
            }`}
          >
            <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>
          <Link
            to="/visualizations"
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors mt-1 ${
              location.pathname.startsWith('/visualizations')
                ? 'bg-dark-500 text-accent'
                : 'text-dark-100 hover:text-white hover:bg-dark-600'
            }`}
          >
            <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Visualizations
          </Link>
          <Link
            to="/team"
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors mt-1 ${
              location.pathname === '/team'
                ? 'bg-dark-500 text-accent'
                : 'text-dark-100 hover:text-white hover:bg-dark-600'
            }`}
          >
            <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Team
          </Link>
          <Link
            to="/audit-logs"
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors mt-1 ${
              location.pathname === '/audit-logs'
                ? 'bg-dark-500 text-accent'
                : 'text-dark-100 hover:text-white hover:bg-dark-600'
            }`}
          >
            <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Audit Logs
          </Link>
          <Link
            to="/notifications"
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors mt-1 ${
              location.pathname === '/notifications'
                ? 'bg-dark-500 text-accent'
                : 'text-dark-100 hover:text-white hover:bg-dark-600'
            }`}
          >
            <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Notifications
          </Link>
          <Link
            to="/settings/notifications"
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors mt-1 ${
              location.pathname === '/settings/notifications'
                ? 'bg-dark-500 text-accent'
                : 'text-dark-100 hover:text-white hover:bg-dark-600'
            }`}
          >
            <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>
        </div>

        <div>
          <h3 className="px-3 text-xs font-semibold text-dark-100 uppercase tracking-wider mb-2">
            Databases
          </h3>
          <div className="space-y-1">
            {databases.map((db) => {
              const isActive = location.pathname.startsWith(`/databases/${db.slug}`)
              return (
                <Link
                  key={db.id}
                  to={`/databases/${db.slug}`}
                  className={`flex items-center px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-dark-500 text-accent'
                      : 'text-dark-100 hover:text-white hover:bg-dark-600'
                  }`}
                >
                  <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                  {db.title}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </aside>
  )
}
