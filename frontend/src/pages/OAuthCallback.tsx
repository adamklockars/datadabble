import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { handleOAuthCallback } from '../api/oauth'
import Loading from '../components/ui/Loading'

export default function OAuthCallback() {
  const navigate = useNavigate()
  const { provider } = useParams<{ provider: string }>()
  const [searchParams] = useSearchParams()
  const { setUser, setTokens } = useAuthStore()
  const [error, setError] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const storedState = sessionStorage.getItem('oauth_state')

    if (!code || !provider) {
      setError('Missing authorization code')
      setTimeout(() => navigate('/login'), 2000)
      return
    }

    if (state && storedState && state !== storedState) {
      setError('Invalid state parameter')
      setTimeout(() => navigate('/login'), 2000)
      return
    }

    sessionStorage.removeItem('oauth_state')
    sessionStorage.removeItem('oauth_provider')

    handleOAuthCallback(provider, code, state || '')
      .then(response => {
        setUser(response.user)
        setTokens(response.access_token, response.refresh_token)
        navigate('/dashboard')
      })
      .catch(() => {
        setError('Authentication failed. Please try again.')
        setTimeout(() => navigate('/login'), 2000)
      })
  }, [provider, searchParams, navigate, setUser, setTokens])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-800">
        <div className="text-center">
          <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-6 py-4 rounded-lg">
            {error}
          </div>
          <p className="mt-4 text-dark-100 text-sm">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-800">
      <div className="text-center">
        <Loading />
        <p className="mt-4 text-dark-100">Completing sign in...</p>
      </div>
    </div>
  )
}
