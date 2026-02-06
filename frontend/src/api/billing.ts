import apiClient from './client'
import type { PlansResponse, BillingInfo, Invoice } from '../types/billing'

export async function getPlans(): Promise<PlansResponse> {
  const { data } = await apiClient.get('/billing/plans')
  return data
}

export async function getSubscription(): Promise<BillingInfo> {
  const { data } = await apiClient.get('/billing/subscription')
  return data
}

export async function createCheckoutSession(priceId: string): Promise<{ checkout_url: string }> {
  const { data } = await apiClient.post('/billing/checkout', { price_id: priceId })
  return data
}

export async function createPortalSession(): Promise<{ portal_url: string }> {
  const { data } = await apiClient.post('/billing/portal')
  return data
}

export async function getInvoices(): Promise<{ invoices: Invoice[] }> {
  const { data } = await apiClient.get('/billing/invoices')
  return data
}
