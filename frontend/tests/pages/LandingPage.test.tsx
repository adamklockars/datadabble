import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../helpers/renderWithProviders'

vi.mock('../../src/store/authStore', () => ({
  useAuthStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      isAuthenticated: false,
      user: null,
    })
  ),
}))

vi.mock('../../src/hooks/useBilling', () => ({
  usePlans: vi.fn(() => ({
    data: null,
    isLoading: true,
  })),
}))

import LandingPage from '../../src/pages/LandingPage'

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders main heading/tagline', () => {
    renderWithProviders(<LandingPage />)
    expect(screen.getByText('Build databases')).toBeInTheDocument()
    expect(screen.getByText('without limits')).toBeInTheDocument()
    expect(
      screen.getByText(/Create custom databases with flexible schemas/i)
    ).toBeInTheDocument()
  })

  it('shows login/register links when not authenticated', () => {
    renderWithProviders(<LandingPage />)
    expect(screen.getByText('Sign In')).toBeInTheDocument()
    const signInLink = screen.getByText('Sign In').closest('a')
    expect(signInLink).toHaveAttribute('href', '/login')

    // There may be multiple "Get Started Free" links on the page
    const getStartedLinks = screen.getAllByText('Get Started Free')
    expect(getStartedLinks.length).toBeGreaterThan(0)
    const firstLink = getStartedLinks[0].closest('a')
    expect(firstLink).toHaveAttribute('href', '/register')
  })

  it('renders feature sections', () => {
    renderWithProviders(<LandingPage />)
    expect(screen.getByText('Everything you need to manage data')).toBeInTheDocument()
    expect(screen.getByText('Flexible Schemas')).toBeInTheDocument()
    expect(screen.getByText('Spreadsheet View')).toBeInTheDocument()
    expect(screen.getByText('Advanced Filtering')).toBeInTheDocument()
    expect(screen.getByText('Team Collaboration')).toBeInTheDocument()
    expect(screen.getByText('AI-Powered Insights')).toBeInTheDocument()
    expect(screen.getByText('Visualizations')).toBeInTheDocument()
  })
})
