import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePlans, useSubscription, useCheckout, usePortal, useInvoices } from '../hooks/useBilling'
import { Button, Loading } from '../components/ui'
import type { StripePrice } from '../types/billing'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount / 100)
}

function UsageMeter({ label, current, limit }: { label: string; current: number; limit: number | null }) {
  if (limit === null) {
    return (
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-dark-100">{label}</span>
          <span className="text-white">{current} / Unlimited</span>
        </div>
        <div className="w-full bg-dark-600 rounded-full h-2">
          <div className="bg-accent rounded-full h-2" style={{ width: '10%' }} />
        </div>
      </div>
    )
  }

  const pct = limit > 0 ? Math.min((current / limit) * 100, 100) : 0
  const isNearLimit = pct >= 80

  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-dark-100">{label}</span>
        <span className={isNearLimit ? 'text-yellow-400' : 'text-white'}>
          {current} / {limit}
        </span>
      </div>
      <div className="w-full bg-dark-600 rounded-full h-2">
        <div
          className={`rounded-full h-2 transition-all ${isNearLimit ? 'bg-yellow-400' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function PricingCard({
  price,
  onSelect,
  loading,
  isCurrentInterval,
}: {
  price: StripePrice
  onSelect: () => void
  loading: boolean
  isCurrentInterval: boolean
}) {
  const interval = price.interval === 'year' ? '/year' : '/month'
  const monthlyEquivalent = price.interval === 'year'
    ? formatCurrency(Math.round(price.unit_amount / 12), price.currency)
    : null

  return (
    <div className={`bg-dark-700 border rounded-xl p-6 ${isCurrentInterval ? 'border-accent' : 'border-dark-500'}`}>
      <div className="text-2xl font-bold text-white mb-1">
        {formatCurrency(price.unit_amount, price.currency)}
        <span className="text-sm font-normal text-dark-100">{interval}</span>
      </div>
      {monthlyEquivalent && (
        <p className="text-sm text-dark-200 mb-4">{monthlyEquivalent}/month equivalent</p>
      )}
      <Button onClick={onSelect} loading={loading} className="w-full mt-4">
        Upgrade to Pro
      </Button>
    </div>
  )
}

export default function Billing() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month')

  const { data: plans, isLoading: plansLoading } = usePlans()
  const { data: billing, isLoading: billingLoading } = useSubscription()
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices()
  const checkout = useCheckout()
  const portal = usePortal()

  if (plansLoading || billingLoading) {
    return <Loading message="Loading billing information..." />
  }

  const isPro = billing?.plan === 'pro'
  const subscription = billing?.subscription

  const monthlyPrices = (plans?.pro.prices || []).filter(p => p.interval === 'month')
  const yearlyPrices = (plans?.pro.prices || []).filter(p => p.interval === 'year')
  const activePrices = billingInterval === 'year' ? yearlyPrices : monthlyPrices

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Billing</h1>

      {/* Success banner */}
      {sessionId && (
        <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4 text-green-400 mb-6">
          Your subscription has been activated. Welcome to Pro!
        </div>
      )}

      {/* Current Plan Banner */}
      <div className={`rounded-xl p-6 mb-8 border ${isPro ? 'bg-accent/10 border-accent/30' : 'bg-dark-700 border-dark-500'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {isPro ? 'Pro Plan' : 'Free Plan'}
            </h2>
            {isPro && subscription && (
              <p className="text-sm text-dark-100 mt-1">
                {subscription.cancel_at_period_end
                  ? `Cancels on ${new Date(subscription.current_period_end!).toLocaleDateString()}`
                  : `Renews on ${new Date(subscription.current_period_end!).toLocaleDateString()}`
                }
              </p>
            )}
            {!isPro && (
              <p className="text-sm text-dark-100 mt-1">
                Upgrade to Pro for unlimited databases, entries, fields, members, and more.
              </p>
            )}
          </div>
          {isPro && (
            <Button
              variant="secondary"
              onClick={() => portal.mutate()}
              loading={portal.isPending}
            >
              Manage Subscription
            </Button>
          )}
        </div>
      </div>

      {/* Usage Meters */}
      {billing && (
        <div className="bg-dark-700 rounded-xl p-6 mb-8 border border-dark-500">
          <h3 className="text-lg font-semibold text-white mb-4">Usage</h3>
          <UsageMeter
            label="Databases"
            current={billing.usage.databases}
            limit={billing.limits.max_databases}
          />
          <UsageMeter
            label="Team Members"
            current={billing.usage.members}
            limit={billing.limits.max_members}
          />
          <UsageMeter
            label="Visualizations"
            current={billing.usage.visualizations}
            limit={billing.limits.max_visualizations}
          />
        </div>
      )}

      {/* Pricing Cards (free users only) */}
      {!isPro && plans && (activePrices.length > 0 || monthlyPrices.length > 0 || yearlyPrices.length > 0) && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Upgrade to Pro</h3>

          {/* Interval toggle */}
          {monthlyPrices.length > 0 && yearlyPrices.length > 0 && (
            <div className="flex items-center gap-3 mb-6">
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  billingInterval === 'month' ? 'bg-accent text-white' : 'bg-dark-600 text-dark-100 hover:text-white'
                }`}
                onClick={() => setBillingInterval('month')}
              >
                Monthly
              </button>
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  billingInterval === 'year' ? 'bg-accent text-white' : 'bg-dark-600 text-dark-100 hover:text-white'
                }`}
                onClick={() => setBillingInterval('year')}
              >
                Annual
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Free tier card */}
            <div className="bg-dark-700 border border-dark-500 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-white mb-2">Free</h4>
              <div className="text-2xl font-bold text-white mb-4">
                $0<span className="text-sm font-normal text-dark-100">/month</span>
              </div>
              <ul className="space-y-2 text-sm text-dark-100">
                <li>Up to {plans.free.limits.max_databases} databases</li>
                <li>Up to {plans.free.limits.max_entries_per_db} entries per database</li>
                <li>Up to {plans.free.limits.max_fields_per_db} fields per database</li>
                <li>Up to {plans.free.limits.max_members} team members</li>
                <li>Up to {plans.free.limits.max_visualizations} visualizations</li>
              </ul>
              <div className="mt-4">
                <Button variant="secondary" disabled className="w-full">
                  Current Plan
                </Button>
              </div>
            </div>

            {/* Pro tier cards */}
            {activePrices.map((price) => (
              <PricingCard
                key={price.id}
                price={price}
                onSelect={() => checkout.mutate(price.id)}
                loading={checkout.isPending}
                isCurrentInterval={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Billing History */}
      <div className="bg-dark-700 rounded-xl p-6 border border-dark-500">
        <h3 className="text-lg font-semibold text-white mb-4">Billing History</h3>
        {invoicesLoading ? (
          <p className="text-dark-100 text-sm">Loading invoices...</p>
        ) : invoices.length === 0 ? (
          <p className="text-dark-100 text-sm">No invoices yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-500">
                  <th className="text-left py-2 text-dark-100 font-medium">Date</th>
                  <th className="text-left py-2 text-dark-100 font-medium">Invoice</th>
                  <th className="text-left py-2 text-dark-100 font-medium">Amount</th>
                  <th className="text-left py-2 text-dark-100 font-medium">Status</th>
                  <th className="text-right py-2 text-dark-100 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-dark-600">
                    <td className="py-3 text-white">
                      {new Date(inv.created * 1000).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-white">{inv.number || inv.id}</td>
                    <td className="py-3 text-white">
                      {formatCurrency(inv.amount_paid, inv.currency)}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        inv.status === 'paid'
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-yellow-900/50 text-yellow-400'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {inv.hosted_invoice_url && (
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:text-accent-light text-sm"
                        >
                          View
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
