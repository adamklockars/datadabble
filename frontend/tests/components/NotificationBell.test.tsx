import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../helpers/renderWithProviders'

const mockMutate = vi.fn()
const mockMutateAll = vi.fn()

vi.mock('../../src/hooks/useNotifications', () => ({
  useUnreadCount: vi.fn(() => ({ data: 0 })),
  useNotifications: vi.fn(() => ({
    data: {
      notifications: [],
      pagination: { page: 1, pages: 1, total: 0, per_page: 8 },
      unread_count: 0,
    },
  })),
  useMarkAsRead: vi.fn(() => ({ mutate: mockMutate })),
  useMarkAllAsRead: vi.fn(() => ({ mutate: mockMutateAll })),
}))

import NotificationBell from '../../src/components/NotificationBell'
import { useUnreadCount, useNotifications } from '../../src/hooks/useNotifications'

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders bell icon', () => {
    renderWithProviders(<NotificationBell />)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    const svg = button.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('shows unread count badge when count > 0', () => {
    vi.mocked(useUnreadCount).mockReturnValue({ data: 5 } as ReturnType<typeof useUnreadCount>)
    renderWithProviders(<NotificationBell />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('does not show badge when count is 0', () => {
    vi.mocked(useUnreadCount).mockReturnValue({ data: 0 } as ReturnType<typeof useUnreadCount>)
    renderWithProviders(<NotificationBell />)
    // The badge span should not exist when count is 0
    const badge = document.querySelector('.absolute.-top-1')
    expect(badge).not.toBeInTheDocument()
  })

  it('opens dropdown on click with notification data', () => {
    vi.mocked(useUnreadCount).mockReturnValue({ data: 2 } as ReturnType<typeof useUnreadCount>)
    vi.mocked(useNotifications).mockReturnValue({
      data: {
        notifications: [
          {
            id: '1',
            title: 'New entry added',
            message: 'An entry was added to Customers',
            read: false,
            link: '/databases/customers',
            created_at: new Date().toISOString(),
            notification_type: 'entry_created',
            read_at: null,
            actor_email: null,
            database_slug: null,
            resource_type: null,
            resource_id: null,
          },
          {
            id: '2',
            title: 'Team invite',
            message: null,
            read: true,
            link: null,
            created_at: new Date().toISOString(),
            notification_type: 'team_invite',
            read_at: null,
            actor_email: null,
            database_slug: null,
            resource_type: null,
            resource_id: null,
          },
        ],
        pagination: { page: 1, pages: 1, total: 2, per_page: 8 },
        unread_count: 1,
      },
    } as ReturnType<typeof useNotifications>)

    renderWithProviders(<NotificationBell />)

    // Dropdown should not be visible initially
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()

    // Click the bell button
    fireEvent.click(screen.getByRole('button'))

    // Dropdown should now be visible
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('New entry added')).toBeInTheDocument()
    expect(screen.getByText('Team invite')).toBeInTheDocument()
    expect(screen.getByText('View all notifications')).toBeInTheDocument()
  })
})
