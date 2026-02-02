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
