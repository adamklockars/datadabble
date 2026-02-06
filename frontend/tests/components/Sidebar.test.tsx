import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../helpers/renderWithProviders'

vi.mock('../../src/api', () => ({
  getDatabases: vi.fn().mockResolvedValue([
    { id: '1', title: 'Customers', slug: 'customers', description: '', created_at: '2024-01-01', updated_at: '2024-01-01' },
    { id: '2', title: 'Products', slug: 'products', description: '', created_at: '2024-01-02', updated_at: '2024-01-02' },
  ]),
}))

import Sidebar from '../../src/components/Sidebar'

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dashboard link', () => {
    renderWithProviders(<Sidebar />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    const link = screen.getByText('Dashboard').closest('a')
    expect(link).toHaveAttribute('href', '/dashboard')
  })

  it('renders visualizations link', () => {
    renderWithProviders(<Sidebar />)
    expect(screen.getByText('Visualizations')).toBeInTheDocument()
    const link = screen.getByText('Visualizations').closest('a')
    expect(link).toHaveAttribute('href', '/visualizations')
  })

  it('renders developer section with Developer Portal and OAuth Clients links', () => {
    renderWithProviders(<Sidebar />)
    expect(screen.getByText('Developer')).toBeInTheDocument()
    expect(screen.getByText('Developer Portal')).toBeInTheDocument()
    expect(screen.getByText('OAuth Clients')).toBeInTheDocument()

    const portalLink = screen.getByText('Developer Portal').closest('a')
    expect(portalLink).toHaveAttribute('href', '/developer')

    const clientsLink = screen.getByText('OAuth Clients').closest('a')
    expect(clientsLink).toHaveAttribute('href', '/developer/clients')
  })

  it('renders API Docs external link with target="_blank"', () => {
    renderWithProviders(<Sidebar />)
    expect(screen.getByText('API Docs')).toBeInTheDocument()
    const link = screen.getByText('API Docs').closest('a')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAttribute('href', '/api/docs/')
  })

  it('renders database list from query data', async () => {
    renderWithProviders(<Sidebar />)
    expect(await screen.findByText('Customers')).toBeInTheDocument()
    expect(await screen.findByText('Products')).toBeInTheDocument()

    const customersLink = screen.getByText('Customers').closest('a')
    expect(customersLink).toHaveAttribute('href', '/databases/customers')

    const productsLink = screen.getByText('Products').closest('a')
    expect(productsLink).toHaveAttribute('href', '/databases/products')
  })

  it('highlights active link based on location', () => {
    window.history.pushState({}, '', '/dashboard')
    renderWithProviders(<Sidebar />)
    const dashboardLink = screen.getByText('Dashboard').closest('a')
    expect(dashboardLink?.className).toContain('text-accent')
  })
})
