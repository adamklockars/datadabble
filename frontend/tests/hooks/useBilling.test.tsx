import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('../../src/api/billing', () => ({
  getPlans: vi.fn(),
  getSubscription: vi.fn(),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  getInvoices: vi.fn(),
}))

import {
  getPlans,
  getSubscription,
  createCheckoutSession,
  createPortalSession,
  getInvoices,
} from '../../src/api/billing'
import {
  usePlans,
  useSubscription,
  useCheckout,
  usePortal,
  useInvoices,
} from '../../src/hooks/useBilling'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

// Save and mock window.location
const originalLocation = window.location

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...originalLocation, href: '' },
  })
})

describe('usePlans', () => {
  it('fetches billing plans', async () => {
    const mockPlans = {
      free: {
        name: 'Free',
        limits: {
          max_databases: 3,
          max_entries_per_db: 100,
          max_fields_per_db: 10,
          max_members: 1,
          ai_queries_per_day: 5,
          max_visualizations: 2,
        },
      },
      pro: {
        name: 'Pro',
        prices: [
          {
            id: 'price_monthly',
            currency: 'usd',
            unit_amount: 999,
            interval: 'month' as const,
            interval_count: 1,
            product_name: 'Pro Monthly',
          },
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
    vi.mocked(getPlans).mockResolvedValueOnce(mockPlans)

    const { result } = renderHook(() => usePlans(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockPlans)
    expect(getPlans).toHaveBeenCalledOnce()
  })

  it('handles fetch error', async () => {
    vi.mocked(getPlans).mockRejectedValueOnce(new Error('Server error'))

    const { result } = renderHook(() => usePlans(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('useSubscription', () => {
  it('fetches current subscription info', async () => {
    const mockBilling = {
      plan: 'free' as const,
      limits: {
        max_databases: 3,
        max_entries_per_db: 100,
        max_fields_per_db: 10,
        max_members: 1,
        ai_queries_per_day: 5,
        max_visualizations: 2,
      },
      usage: {
        databases: 1,
        members: 1,
        visualizations: 0,
      },
      subscription: null,
    }
    vi.mocked(getSubscription).mockResolvedValueOnce(mockBilling)

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockBilling)
    expect(getSubscription).toHaveBeenCalledOnce()
  })

  it('fetches pro subscription info', async () => {
    const mockBilling = {
      plan: 'pro' as const,
      limits: {
        max_databases: null,
        max_entries_per_db: null,
        max_fields_per_db: null,
        max_members: null,
        ai_queries_per_day: null,
        max_visualizations: null,
      },
      usage: {
        databases: 5,
        members: 3,
        visualizations: 10,
      },
      subscription: {
        id: 'sub_1',
        account_id: 'acc_1',
        stripe_subscription_id: 'sub_stripe_1',
        stripe_price_id: 'price_monthly',
        status: 'active',
        current_period_start: '2024-01-01',
        current_period_end: '2024-02-01',
        cancel_at_period_end: false,
        canceled_at: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        is_pro: true,
      },
    }
    vi.mocked(getSubscription).mockResolvedValueOnce(mockBilling)

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.plan).toBe('pro')
    expect(result.current.data?.subscription?.is_pro).toBe(true)
  })
})

describe('useCheckout', () => {
  it('creates a checkout session and redirects', async () => {
    const mockResponse = { checkout_url: 'https://checkout.stripe.com/session_123' }
    vi.mocked(createCheckoutSession).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useCheckout(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate('price_monthly')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(createCheckoutSession).toHaveBeenCalledWith('price_monthly')
    expect(window.location.href).toBe('https://checkout.stripe.com/session_123')
  })

  it('handles checkout error', async () => {
    vi.mocked(createCheckoutSession).mockRejectedValueOnce(new Error('Payment error'))

    const { result } = renderHook(() => useCheckout(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate('price_invalid')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('usePortal', () => {
  it('creates a portal session and redirects', async () => {
    const mockResponse = { portal_url: 'https://billing.stripe.com/portal_123' }
    vi.mocked(createPortalSession).mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => usePortal(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(createPortalSession).toHaveBeenCalledOnce()
    expect(window.location.href).toBe('https://billing.stripe.com/portal_123')
  })

  it('handles portal error', async () => {
    vi.mocked(createPortalSession).mockRejectedValueOnce(new Error('Portal error'))

    const { result } = renderHook(() => usePortal(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})

describe('useInvoices', () => {
  it('fetches invoices and selects the invoices array', async () => {
    const mockInvoices = [
      {
        id: 'inv_1',
        number: 'INV-001',
        status: 'paid',
        amount_due: 999,
        amount_paid: 999,
        currency: 'usd',
        created: 1704067200,
        hosted_invoice_url: 'https://invoice.stripe.com/inv_1',
        invoice_pdf: 'https://invoice.stripe.com/inv_1.pdf',
        period_start: 1704067200,
        period_end: 1706745600,
      },
    ]
    vi.mocked(getInvoices).mockResolvedValueOnce({ invoices: mockInvoices })

    const { result } = renderHook(() => useInvoices(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // useInvoices uses select to extract the invoices array
    expect(result.current.data).toEqual(mockInvoices)
    expect(getInvoices).toHaveBeenCalledOnce()
  })

  it('handles empty invoices', async () => {
    vi.mocked(getInvoices).mockResolvedValueOnce({ invoices: [] })

    const { result } = renderHook(() => useInvoices(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([])
  })

  it('handles fetch error', async () => {
    vi.mocked(getInvoices).mockRejectedValueOnce(new Error('Server error'))

    const { result } = renderHook(() => useInvoices(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})
