import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { register } from '../api'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import SocialLoginButtons from '../components/SocialLoginButtons'

export default function Register() {
  const navigate = useNavigate()
  const { setUser, setTokens } = useAuthStore()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const response = await register({
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
      })
      setUser(response.user)
      setTokens(response.access_token, response.refresh_token)
      navigate('/dashboard')
    } catch (err) {
      setError('Registration failed. Email may already be in use.')
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
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-dark-100">
            Or{' '}
            <Link to="/login" className="font-medium text-accent hover:text-accent-light">
              sign in to existing account
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
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                autoComplete="given-name"
              />
              <Input
                label="Last name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                autoComplete="family-name"
              />
            </div>

            <Input
              label="Email address"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />

            <Input
              label="Confirm password"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Create account
          </Button>

          <SocialLoginButtons />
        </form>
      </div>
    </div>
  )
}
