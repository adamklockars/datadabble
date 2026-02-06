import { useQuery, useMutation } from '@tanstack/react-query'
import {
  getPlans,
  getSubscription,
  createCheckoutSession,
  createPortalSession,
  getInvoices,
} from '../api/billing'

export function usePlans() {
  return useQuery({
    queryKey: ['billing-plans'],
    queryFn: getPlans,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useSubscription() {
  return useQuery({
    queryKey: ['billing-subscription'],
    queryFn: getSubscription,
  })
}

export function useCheckout() {
  return useMutation({
    mutationFn: (priceId: string) => createCheckoutSession(priceId),
    onSuccess: (data) => {
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      }
    },
  })
}

export function usePortal() {
  return useMutation({
    mutationFn: () => createPortalSession(),
    onSuccess: (data) => {
      if (data.portal_url) {
        window.location.href = data.portal_url
      }
    },
  })
}

export function useInvoices() {
  return useQuery({
    queryKey: ['billing-invoices'],
    queryFn: getInvoices,
    select: (data) => data.invoices,
  })
}
