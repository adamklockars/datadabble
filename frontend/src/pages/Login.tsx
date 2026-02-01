import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { login } from '../api'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function Login() {
  const navigate = useNavigate()
  const { setUser, setTokens } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await login({ email, password })
      setUser(response.user)
      setTokens(response.access_token, response.refresh_token)
      navigate('/dashboard')
    } catch (err) {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold">
            <span className="text-accent">Data</span>
            <span className="text-white">Dabble</span>
          </h1>
          <h2 className="mt-6 text-center text-2xl font-bold text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-dark-100">
            Or{' '}
            <Link to="/register" className="font-medium text-accent hover:text-accent-light">
              create a new account
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  )
}
