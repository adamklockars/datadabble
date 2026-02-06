import { Link } from 'react-router-dom'
import type { PlanLimitError } from '../types/billing'

interface UpgradeBannerProps {
  error: PlanLimitError | null
  onDismiss?: () => void
}

export default function UpgradeBanner({ error, onDismiss }: UpgradeBannerProps) {
  if (!error) return null

  return (
    <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <div>
            <p className="text-sm text-yellow-200">{error.message}</p>
            <Link
              to="/billing"
              className="inline-block mt-2 text-sm font-medium text-accent hover:text-accent-light transition-colors"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-dark-200 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Extract a PlanLimitError from an axios error response, or return null.
 */
export function extractPlanLimitError(error: unknown): PlanLimitError | null {
  if (!error || typeof error !== 'object') return null
  const axiosErr = error as { response?: { status?: number; data?: Record<string, unknown> } }
  if (axiosErr.response?.status === 403 && axiosErr.response?.data?.limit_type) {
    return axiosErr.response.data as unknown as PlanLimitError
  }
  return null
}
