import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { logout } from '../api'

export default function Header() {
  const { user, logout: clearAuth } = useAuthStore()

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // Ignore errors, clear auth anyway
    }
    clearAuth()
  }

  return (
    <header className="bg-dark-900 border-b border-dark-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/dashboard" className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-accent">Data</span>
            <span>Dabble</span>
          </Link>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-dark-100">
              {user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-dark-100 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
