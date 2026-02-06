import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../helpers/renderWithProviders'

const mockGetDatabases = vi.fn()

vi.mock('../../src/api', () => ({
  getDatabases: (...args: unknown[]) => mockGetDatabases(...args),
  createDatabase: vi.fn(),
  deleteDatabase: vi.fn(),
}))

vi.mock('../../src/components/UpgradeBanner', () => ({
  default: ({ error }: { error: unknown }) => error ? <div data-testid="upgrade-banner">Upgrade</div> : null,
  extractPlanLimitError: vi.fn(() => null),
}))

vi.mock('../../src/components/ui', () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  ),
  Modal: ({ isOpen, children, title }: { isOpen: boolean; children: React.ReactNode; title: string }) =>
    isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
  Input: (props: Record<string, unknown>) => <input {...props} />,
  Loading: ({ message }: { message?: string }) => <div data-testid="loading">{message || 'Loading...'}</div>,
}))

import Dashboard from '../../src/pages/Dashboard'

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state', () => {
    mockGetDatabases.mockReturnValue(new Promise(() => {})) // never resolves
    renderWithProviders(<Dashboard />)
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.getByText('Loading databases...')).toBeInTheDocument()
  })

  it('renders database list', async () => {
    mockGetDatabases.mockResolvedValue([
      { id: '1', title: 'Customers', slug: 'customers', description: 'Customer data', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
      { id: '2', title: 'Products', slug: 'products', description: '', created_at: '2024-01-02T00:00:00Z', updated_at: '2024-01-02T00:00:00Z' },
    ])
    renderWithProviders(<Dashboard />)
    expect(await screen.findByText('Customers')).toBeInTheDocument()
    expect(await screen.findByText('Products')).toBeInTheDocument()
  })

  it('renders empty state when no databases', async () => {
    mockGetDatabases.mockResolvedValue([])
    renderWithProviders(<Dashboard />)
    expect(await screen.findByText('No databases')).toBeInTheDocument()
    expect(screen.getByText('Get started by creating a new database.')).toBeInTheDocument()
  })

  it('shows create database button', async () => {
    mockGetDatabases.mockResolvedValue([])
    renderWithProviders(<Dashboard />)
    const buttons = await screen.findAllByText('Create Database')
    expect(buttons.length).toBeGreaterThan(0)
  })
})
