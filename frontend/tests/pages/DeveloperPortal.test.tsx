import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../helpers/renderWithProviders'

vi.mock('../../src/hooks/useDeveloper', () => ({
  useScopes: vi.fn(() => ({
    data: [
      { name: 'read:databases', description: 'Read access to databases' },
      { name: 'write:databases', description: 'Write access to databases' },
      { name: 'read:entries', description: 'Read access to entries' },
    ],
  })),
}))

import DeveloperPortal from '../../src/pages/DeveloperPortal'

describe('DeveloperPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders hero section with "Build with DataDabble API" title', () => {
    renderWithProviders(<DeveloperPortal />)
    expect(screen.getByText('Build with DataDabble API')).toBeInTheDocument()
    expect(
      screen.getByText(/Integrate your applications with DataDabble/i)
    ).toBeInTheDocument()
  })

  it('renders quick links (OAuth Clients, API Documentation, Quick Start)', () => {
    renderWithProviders(<DeveloperPortal />)
    const oauthElements = screen.getAllByText('OAuth Clients')
    expect(oauthElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('API Documentation')).toBeInTheDocument()
    expect(screen.getByText('Quick Start')).toBeInTheDocument()

    const oauthLink = oauthElements[0].closest('a')
    expect(oauthLink).toHaveAttribute('href', '/developer/clients')

    const docsLink = screen.getByText('API Documentation').closest('a')
    expect(docsLink).toHaveAttribute('href', '/api/docs/')
    expect(docsLink).toHaveAttribute('target', '_blank')
  })

  it('renders getting started guide', () => {
    renderWithProviders(<DeveloperPortal />)
    expect(screen.getByText('Getting Started')).toBeInTheDocument()
    expect(screen.getByText('1. Create an OAuth Client')).toBeInTheDocument()
    expect(screen.getByText('2. Authenticate with the API')).toBeInTheDocument()
    expect(screen.getByText('3. Or use OAuth 2.0 for third-party apps')).toBeInTheDocument()
  })

  it('renders scopes list from API data', () => {
    renderWithProviders(<DeveloperPortal />)
    expect(screen.getByText('Available Scopes')).toBeInTheDocument()
    expect(screen.getByText('read:databases')).toBeInTheDocument()
    expect(screen.getByText('Read access to databases')).toBeInTheDocument()
    expect(screen.getByText('write:databases')).toBeInTheDocument()
    expect(screen.getByText('Write access to databases')).toBeInTheDocument()
    expect(screen.getByText('read:entries')).toBeInTheDocument()
    expect(screen.getByText('Read access to entries')).toBeInTheDocument()
  })
})
