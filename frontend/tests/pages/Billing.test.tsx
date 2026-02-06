import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../helpers/renderWithProviders'

const mockUsePlans = vi.fn()
const mockUseSubscription = vi.fn()
const mockUseInvoices = vi.fn()

vi.mock('../../src/hooks/useBilling', () => ({
  usePlans: (...args: unknown[]) => mockUsePlans(...args),
  useSubscription: (...args: unknown[]) => mockUseSubscription(...args),
  useCheckout: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  usePortal: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useInvoices: (...args: unknown[]) => mockUseInvoices(...args),
}))

vi.mock('../../src/components/ui', () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  ),
  Loading: ({ message }: { message?: string }) => <div data-testid="loading">{message || 'Loading...'}</div>,
}))

import Billing from '../../src/pages/Billing'

const mockPlans = {
  free: {
    name: 'Free',
    limits: {
      max_databases: 3,
      max_entries_per_db: 100,
      max_fields_per_db: 10,
      max_members: 2,
      ai_queries_per_day: 5,
      max_visualizations: 3,
    },
  },
  pro: {
    name: 'Pro',
    prices: [
      { id: 'price_month', currency: 'usd', unit_amount: 1900, interval: 'month', interval_count: 1, product_name: 'Pro' },
    ],
    limits: {
      max_databases: null,
      max_entries_per_db: null,
      max_fields_per_db: null,
      max_members: null,
      ai_queries_per_day: null,
      max_visualizations: null,
    },
  },
}

describe('Billing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseInvoices.mockReturnValue({ data: [], isLoading: false })
  })

  it('renders plan information', () => {
    mockUsePlans.mockReturnValue({ data: mockPlans, isLoading: false })
    mockUseSubscription.mockReturnValue({
      data: {
        plan: 'free',
        limits: mockPlans.free.limits,
        usage: { databases: 1, members: 1, visualizations: 0 },
        subscription: null,
      },
      isLoading: false,
    })

    renderWithProviders(<Billing />)
    expect(screen.getByText('Billing')).toBeInTheDocument()
    expect(screen.getByText('Free Plan')).toBeInTheDocument()
  })

  it('shows subscription status for pro users', () => {
    mockUsePlans.mockReturnValue({ data: mockPlans, isLoading: false })
    mockUseSubscription.mockReturnValue({
      data: {
        plan: 'pro',
        limits: mockPlans.pro.limits,
        usage: { databases: 5, members: 3, visualizations: 2 },
        subscription: {
          id: 'sub_1',
          account_id: 'acc_1',
          stripe_subscription_id: 'sub_stripe_1',
          stripe_price_id: 'price_month',
          status: 'active',
          current_period_start: '2024-01-01T00:00:00Z',
          current_period_end: '2024-02-01T00:00:00Z',
          cancel_at_period_end: false,
          canceled_at: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          is_pro: true,
        },
      },
      isLoading: false,
    })

    renderWithProviders(<Billing />)
    expect(screen.getByText('Pro Plan')).toBeInTheDocument()
    expect(screen.getByText('Manage Subscription')).toBeInTheDocument()
  })

  it('renders upgrade button for free plan', () => {
    mockUsePlans.mockReturnValue({ data: mockPlans, isLoading: false })
    mockUseSubscription.mockReturnValue({
      data: {
        plan: 'free',
        limits: mockPlans.free.limits,
        usage: { databases: 1, members: 1, visualizations: 0 },
        subscription: null,
      },
      isLoading: false,
    })

    renderWithProviders(<Billing />)
    expect(screen.getByText('Free Plan')).toBeInTheDocument()
    const upgradeButtons = screen.getAllByText('Upgrade to Pro')
    expect(upgradeButtons.length).toBeGreaterThan(0)
  })
})
