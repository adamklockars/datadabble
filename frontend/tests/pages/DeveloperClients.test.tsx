import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../helpers/renderWithProviders'

const mockUseClients = vi.fn()
const mockUseScopes = vi.fn()

vi.mock('../../src/hooks/useDeveloper', () => ({
  useClients: (...args: unknown[]) => mockUseClients(...args),
  useScopes: (...args: unknown[]) => mockUseScopes(...args),
  useCreateClient: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false, isError: false })),
  useUpdateClient: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useDeleteClient: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useRotateSecret: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

import DeveloperClients from '../../src/pages/DeveloperClients'

const mockClients = [
  {
    id: 'c1',
    client_id: 'abcdefghij123456',
    name: 'My Test App',
    description: 'A test application',
    redirect_uris: ['https://example.com/callback'],
    scopes: ['read:databases', 'write:databases'],
    active: true,
    user_id: 'u1',
    account_id: null,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  {
    id: 'c2',
    client_id: 'xyz789abcdef0000',
    name: 'Another App',
    description: '',
    redirect_uris: [],
    scopes: ['read:databases'],
    active: false,
    user_id: 'u1',
    account_id: null,
    created_at: '2024-02-10T00:00:00Z',
    updated_at: '2024-02-10T00:00:00Z',
  },
]

describe('DeveloperClients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseScopes.mockReturnValue({ data: [] })
  })

  it('renders loading state', () => {
    mockUseClients.mockReturnValue({ data: [], isLoading: true })
    renderWithProviders(<DeveloperClients />)
    expect(screen.getByText('Loading clients...')).toBeInTheDocument()
  })

  it('renders empty state with "Create Your First App" button', () => {
    mockUseClients.mockReturnValue({ data: [], isLoading: false })
    renderWithProviders(<DeveloperClients />)
    expect(screen.getByText('No OAuth applications yet')).toBeInTheDocument()
    expect(screen.getByText('Create Your First App')).toBeInTheDocument()
  })

  it('renders client list', () => {
    mockUseClients.mockReturnValue({ data: mockClients, isLoading: false })
    renderWithProviders(<DeveloperClients />)
    expect(screen.getByText('My Test App')).toBeInTheDocument()
    expect(screen.getByText('Another App')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('opens create modal on button click', () => {
    mockUseClients.mockReturnValue({ data: [], isLoading: false })
    mockUseScopes.mockReturnValue({ data: [] })
    renderWithProviders(<DeveloperClients />)

    // Click "Create New App" button in the header
    fireEvent.click(screen.getByText('Create New App'))

    // The create modal should open
    expect(screen.getByText('Create OAuth Application')).toBeInTheDocument()
    expect(screen.getByText('Application Name *')).toBeInTheDocument()
  })

  it('shows client detail on client click', () => {
    mockUseClients.mockReturnValue({ data: mockClients, isLoading: false })
    renderWithProviders(<DeveloperClients />)

    // Click on the first client row
    fireEvent.click(screen.getByText('My Test App'))

    // The detail modal should show client details
    expect(screen.getByText('Client ID')).toBeInTheDocument()
    expect(screen.getByText('Rotate Secret')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })
})
