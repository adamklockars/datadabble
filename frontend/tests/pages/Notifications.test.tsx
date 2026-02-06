import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../helpers/renderWithProviders'

const mockUseNotifications = vi.fn()
const mockMutate = vi.fn()
const mockMutateAll = vi.fn()

vi.mock('../../src/hooks/useNotifications', () => ({
  useNotifications: (...args: unknown[]) => mockUseNotifications(...args),
  useMarkAsRead: vi.fn(() => ({ mutate: mockMutate })),
  useMarkAllAsRead: vi.fn(() => ({ mutate: mockMutateAll })),
}))

vi.mock('../../src/api/notifications', () => ({
  deleteNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../src/components/ui/Button', () => ({
  default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('../../src/components/ui/Loading', () => ({
  default: () => <div data-testid="loading">Loading...</div>,
}))

import Notifications from '../../src/pages/Notifications'

describe('Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders notification list', () => {
    mockUseNotifications.mockReturnValue({
      data: {
        notifications: [
          {
            id: '1',
            title: 'New entry created',
            message: 'A new entry was added to Customers',
            read: false,
            link: '/databases/customers',
            created_at: '2024-01-15T10:00:00Z',
            notification_type: 'entry_created',
            read_at: null,
            actor_email: 'alice@example.com',
            database_slug: 'customers',
            resource_type: 'entry',
            resource_id: 'e1',
          },
          {
            id: '2',
            title: 'Team member joined',
            message: null,
            read: true,
            link: null,
            created_at: '2024-01-14T08:00:00Z',
            notification_type: 'member_joined',
            read_at: '2024-01-14T09:00:00Z',
            actor_email: null,
            database_slug: null,
            resource_type: null,
            resource_id: null,
          },
        ],
        pagination: { page: 1, pages: 1, total: 2, per_page: 20 },
        unread_count: 1,
      },
      isLoading: false,
    })

    renderWithProviders(<Notifications />)
    expect(screen.getByText('New entry created')).toBeInTheDocument()
    expect(screen.getByText('Team member joined')).toBeInTheDocument()
    expect(screen.getByText('by alice@example.com')).toBeInTheDocument()
  })

  it('shows empty state', () => {
    mockUseNotifications.mockReturnValue({
      data: {
        notifications: [],
        pagination: { page: 1, pages: 1, total: 0, per_page: 20 },
        unread_count: 0,
      },
      isLoading: false,
    })

    renderWithProviders(<Notifications />)
    expect(screen.getByText('No notifications yet.')).toBeInTheDocument()
  })

  it('renders mark all read button when there are unread notifications', () => {
    mockUseNotifications.mockReturnValue({
      data: {
        notifications: [
          {
            id: '1',
            title: 'Unread notification',
            message: null,
            read: false,
            link: null,
            created_at: '2024-01-15T10:00:00Z',
            notification_type: 'test',
            read_at: null,
            actor_email: null,
            database_slug: null,
            resource_type: null,
            resource_id: null,
          },
        ],
        pagination: { page: 1, pages: 1, total: 1, per_page: 20 },
        unread_count: 1,
      },
      isLoading: false,
    })

    renderWithProviders(<Notifications />)
    expect(screen.getByText('Mark all read')).toBeInTheDocument()
  })
})
