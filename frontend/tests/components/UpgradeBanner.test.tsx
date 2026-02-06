import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../helpers/renderWithProviders'
import UpgradeBanner from '../../src/components/UpgradeBanner'
import type { PlanLimitError } from '../../src/types/billing'

describe('UpgradeBanner', () => {
  const freePlanError: PlanLimitError = {
    error: 'Plan limit reached',
    limit_type: 'max_databases',
    limit: 3,
    current: 3,
    plan: 'free',
    message: 'You have reached the maximum number of databases on the Free plan.',
  }

  it('renders upgrade message for free plan', () => {
    renderWithProviders(<UpgradeBanner error={freePlanError} />)
    expect(
      screen.getByText('You have reached the maximum number of databases on the Free plan.')
    ).toBeInTheDocument()
  })

  it('shows upgrade button/link to billing', () => {
    renderWithProviders(<UpgradeBanner error={freePlanError} />)
    const upgradeLink = screen.getByText('Upgrade to Pro')
    expect(upgradeLink).toBeInTheDocument()
    expect(upgradeLink.closest('a')).toHaveAttribute('href', '/billing')
  })

  it('does not render when error is null', () => {
    const { container } = renderWithProviders(<UpgradeBanner error={null} />)
    expect(container.innerHTML).toBe('')
  })
})
