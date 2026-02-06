import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getConsentInfo, submitConsent } from '../api/developer'
import { useAuthStore } from '../store/authStore'
import type { ConsentInfo } from '../types/developer'

export default function OAuthConsent() {
  const [searchParams] = useSearchParams()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [consentInfo, setConsentInfo] = useState<ConsentInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const clientId = searchParams.get('client_id') || ''
  const redirectUri = searchParams.get('redirect_uri') || ''
  const scope = searchParams.get('scope') || ''
  const state = searchParams.get('state') || ''

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      setError('You must be logged in to authorize an application.')
      return
    }

    if (!clientId || !redirectUri) {
      setLoading(false)
      setError('Missing required parameters (client_id, redirect_uri).')
      return
    }

    getConsentInfo({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      response_type: 'code',
    })
      .then(setConsentInfo)
      .catch((err) => {
        const msg = err.response?.data?.error_description || err.response?.data?.error || 'Failed to load authorization details.'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [isAuthenticated, clientId, redirectUri, scope, state])

  const handleDecision = async (approved: boolean) => {
    if (!consentInfo) return
    setSubmitting(true)
    try {
      const result = await submitConsent({
        client_id: clientId,
        redirect_uri: redirectUri,
        scopes: consentInfo.scopes.map((s) => s.name),
        state,
        approved,
      })

      // Redirect back to the application
      const url = new URL(result.redirect_uri)
      if (result.code) {
        url.searchParams.set('code', result.code)
      }
      if (result.error) {
        url.searchParams.set('error', result.error)
      }
      if (result.state) {
        url.searchParams.set('state', result.state)
      }
      window.location.href = url.toString()
    } catch (err: any) {
      setError(err.response?.data?.error_description || 'Authorization failed.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <p className="text-dark-100">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <div className="bg-dark-700 border border-dark-400 rounded-lg p-6 max-w-md w-full text-center">
          <svg className="h-12 w-12 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-red-400 mb-4">{error}</p>
          <a href="/login" className="text-accent hover:underline text-sm">Go to Login</a>
        </div>
      </div>
    )
  }

  if (!consentInfo) return null

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="bg-dark-700 border border-dark-400 rounded-lg p-6 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white mb-1">Authorize Application</h1>
          <p className="text-sm text-dark-100">
            <span className="text-white font-semibold">{consentInfo.client.name}</span> is requesting access to your account.
          </p>
          {consentInfo.client.description && (
            <p className="text-xs text-dark-100 mt-1">{consentInfo.client.description}</p>
          )}
        </div>

        {consentInfo.scopes.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-dark-100 mb-2">This application will be able to:</h2>
            <ul className="space-y-2">
              {consentInfo.scopes.map((scope) => (
                <li key={scope.name} className="flex items-start gap-2">
                  <svg className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-white">{scope.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => handleDecision(true)}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-accent text-dark-900 rounded text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
          >
            {submitting ? 'Authorizing...' : 'Authorize'}
          </button>
          <button
            onClick={() => handleDecision(false)}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-dark-600 text-dark-100 rounded text-sm hover:bg-dark-500 disabled:opacity-50"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  )
}
