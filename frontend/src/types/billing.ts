export interface StripePrice {
  id: string
  currency: string
  unit_amount: number
  interval: 'month' | 'year' | null
  interval_count: number | null
  product_name: string
}

export interface PlanLimits {
  max_databases: number | null
  max_entries_per_db: number | null
  max_fields_per_db: number | null
  max_members: number | null
  ai_queries_per_day: number | null
  max_visualizations: number | null
}

export interface AccountUsage {
  databases: number
  members: number
  visualizations: number
}

export interface Subscription {
  id: string
  account_id: string
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  status: string
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  created_at: string
  updated_at: string
  is_pro: boolean
}

export interface BillingInfo {
  plan: 'free' | 'pro'
  limits: PlanLimits
  usage: AccountUsage
  subscription: Subscription | null
}

export interface PlansResponse {
  free: {
    name: string
    limits: PlanLimits
  }
  pro: {
    name: string
    prices: StripePrice[]
    limits: PlanLimits
  }
}

export interface PlanLimitError {
  error: string
  limit_type: string
  limit: number
  current: number
  plan: string
  message: string
}

export interface Invoice {
  id: string
  number: string | null
  status: string
  amount_due: number
  amount_paid: number
  currency: string
  created: number
  hosted_invoice_url: string | null
  invoice_pdf: string | null
  period_start: number
  period_end: number
}
