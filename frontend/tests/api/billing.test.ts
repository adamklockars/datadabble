import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import apiClient from '../../src/api/client'
import {
  getPlans,
  getSubscription,
  createCheckoutSession,
  createPortalSession,
  getInvoices,
} from '../../src/api/billing'

describe('billing API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPlans', () => {
    it('calls GET /billing/plans and returns plans data', async () => {
      const mockPlans = {
        plans: [
          { id: 'free', name: 'Free', price: 0, databases: 3, entries_per_db: 100 },
          { id: 'pro', name: 'Pro', price: 9.99, databases: 50, entries_per_db: 10000 },
          { id: 'enterprise', name: 'Enterprise', price: 49.99, databases: -1, entries_per_db: -1 },
        ],
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockPlans })

      const result = await getPlans()

      expect(apiClient.get).toHaveBeenCalledWith('/billing/plans')
      expect(result).toEqual(mockPlans)
      expect(result.plans).toHaveLength(3)
    })
  })

  describe('getSubscription', () => {
    it('calls GET /billing/subscription and returns billing info', async () => {
      const mockBillingInfo = {
        plan: 'pro',
        status: 'active',
        current_period_end: '2026-03-01T00:00:00Z',
        cancel_at_period_end: false,
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockBillingInfo })

      const result = await getSubscription()

      expect(apiClient.get).toHaveBeenCalledWith('/billing/subscription')
      expect(result).toEqual(mockBillingInfo)
      expect(result.plan).toBe('pro')
      expect(result.status).toBe('active')
    })

    it('returns free plan info for unsubscribed users', async () => {
      const mockBillingInfo = {
        plan: 'free',
        status: 'active',
        current_period_end: null,
        cancel_at_period_end: false,
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockBillingInfo })

      const result = await getSubscription()

      expect(result.plan).toBe('free')
    })
  })

  describe('createCheckoutSession', () => {
    it('calls POST /billing/checkout with price_id and returns checkout URL', async () => {
      const mockResponse = { checkout_url: 'https://checkout.stripe.com/session_abc123' }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await createCheckoutSession('price_pro_monthly')

      expect(apiClient.post).toHaveBeenCalledWith('/billing/checkout', { price_id: 'price_pro_monthly' })
      expect(result.checkout_url).toBe('https://checkout.stripe.com/session_abc123')
    })

    it('propagates errors for invalid price IDs', async () => {
      const error = { response: { status: 400, data: { message: 'Invalid price ID' } } }
      vi.mocked(apiClient.post).mockRejectedValueOnce(error)

      await expect(createCheckoutSession('invalid_price')).rejects.toEqual(error)
    })
  })

  describe('createPortalSession', () => {
    it('calls POST /billing/portal and returns portal URL', async () => {
      const mockResponse = { portal_url: 'https://billing.stripe.com/portal_session_xyz' }
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await createPortalSession()

      expect(apiClient.post).toHaveBeenCalledWith('/billing/portal')
      expect(result.portal_url).toBe('https://billing.stripe.com/portal_session_xyz')
    })

    it('propagates errors when user has no subscription', async () => {
      const error = { response: { status: 400, data: { message: 'No active subscription' } } }
      vi.mocked(apiClient.post).mockRejectedValueOnce(error)

      await expect(createPortalSession()).rejects.toEqual(error)
    })
  })

  describe('getInvoices', () => {
    it('calls GET /billing/invoices and returns invoice list', async () => {
      const mockResponse = {
        invoices: [
          {
            id: 'inv_1',
            amount: 999,
            currency: 'usd',
            status: 'paid',
            created: '2026-01-01T00:00:00Z',
            pdf_url: 'https://stripe.com/invoice/inv_1.pdf',
          },
          {
            id: 'inv_2',
            amount: 999,
            currency: 'usd',
            status: 'paid',
            created: '2025-12-01T00:00:00Z',
            pdf_url: 'https://stripe.com/invoice/inv_2.pdf',
          },
        ],
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await getInvoices()

      expect(apiClient.get).toHaveBeenCalledWith('/billing/invoices')
      expect(result.invoices).toHaveLength(2)
      expect(result.invoices[0].status).toBe('paid')
    })

    it('returns empty invoices for users with no billing history', async () => {
      const mockResponse = { invoices: [] }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await getInvoices()

      expect(result.invoices).toEqual([])
    })
  })
})
