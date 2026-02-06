import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../helpers/renderWithProviders'

const mockListMembers = vi.fn()

vi.mock('../../src/api/users', () => ({
  listMembers: (...args: unknown[]) => mockListMembers(...args),
  inviteMember: vi.fn(),
  updateMember: vi.fn(),
  removeMember: vi.fn(),
  DEFAULT_PERMISSIONS: {
    admin: {
      database: { create: true, read: true, update: true, delete: true },
      field: { create: true, read: true, update: true, delete: true },
      entry: { create: true, read: true, update: true, delete: true },
      user: { create: true, read: true, update: true, delete: true },
    },
    member: {
      database: { create: false, read: true, update: false, delete: false },
      field: { create: false, read: true, update: false, delete: false },
      entry: { create: true, read: true, update: true, delete: false },
      user: { create: false, read: false, update: false, delete: false },
    },
  },
}))

const mockAuthState = {
  isAuthenticated: true,
  user: { id: 'current-user', email: 'me@example.com' },
}

vi.mock('../../src/store/authStore', () => ({
  useAuthStore: vi.fn((selector?: (state: Record<string, unknown>) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState
  ),
}))

vi.mock('../../src/components/ui', () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  ),
  Modal: ({ isOpen, children, title }: { isOpen: boolean; children: React.ReactNode; title: string }) =>
    isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
  Input: (props: Record<string, unknown>) => <input {...props} />,
  Select: (props: Record<string, unknown> & { label?: string; options: Array<{ value: string; label: string }> }) => (
    <select><option>{props.label ?? ''}</option></select>
  ),
}))

vi.mock('../../src/components/UpgradeBanner', () => ({
  default: ({ error }: { error: unknown }) => error ? <div data-testid="upgrade-banner">Upgrade</div> : null,
  extractPlanLimitError: vi.fn(() => null),
}))

import TeamManagement from '../../src/pages/TeamManagement'

const mockMembers = {
  members: [
    {
      id: 'm1',
      account_id: 'acc1',
      user_id: 'current-user',
      user_email: 'me@example.com',
      user_first_name: 'Current',
      user_last_name: 'User',
      role: 'admin' as const,
      permissions: {
        database: { create: true, read: true, update: true, delete: true },
        field: { create: true, read: true, update: true, delete: true },
        entry: { create: true, read: true, update: true, delete: true },
        user: { create: true, read: true, update: true, delete: true },
      },
      status: 'active' as const,
      invited_by_id: null,
      invited_at: null,
      accepted_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'm2',
      account_id: 'acc1',
      user_id: 'user-2',
      user_email: 'alice@example.com',
      user_first_name: 'Alice',
      user_last_name: 'Smith',
      role: 'member' as const,
      permissions: {
        database: { create: false, read: true, update: false, delete: false },
        field: { create: false, read: true, update: false, delete: false },
        entry: { create: true, read: true, update: true, delete: false },
        user: { create: false, read: false, update: false, delete: false },
      },
      status: 'active' as const,
      invited_by_id: 'current-user',
      invited_at: '2024-01-05T00:00:00Z',
      accepted_at: '2024-01-06T00:00:00Z',
      created_at: '2024-01-05T00:00:00Z',
      updated_at: '2024-01-06T00:00:00Z',
    },
  ],
  total: 2,
}

describe('TeamManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders team members list', async () => {
    mockListMembers.mockResolvedValue(mockMembers)
    renderWithProviders(<TeamManagement />)
    expect(await screen.findByText('me@example.com')).toBeInTheDocument()
    expect(await screen.findByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
  })

  it('shows invite button', async () => {
    mockListMembers.mockResolvedValue(mockMembers)
    renderWithProviders(<TeamManagement />)
    expect(await screen.findByText('Invite Member')).toBeInTheDocument()
  })

  it('renders member roles', async () => {
    mockListMembers.mockResolvedValue(mockMembers)
    renderWithProviders(<TeamManagement />)
    expect(await screen.findByText('Administrator')).toBeInTheDocument()
    const memberElements = screen.getAllByText('Member')
    expect(memberElements.length).toBeGreaterThanOrEqual(1)
  })
})
