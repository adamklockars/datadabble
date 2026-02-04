import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { usePlans } from '../hooks/useBilling'
import type { StripePrice } from '../types/billing'

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-dark-700/50 backdrop-blur border border-dark-500 rounded-xl p-6 hover:border-accent/50 transition-all duration-300 hover:transform hover:-translate-y-1">
      <div className="w-12 h-12 bg-gradient-to-br from-accent to-purple-500 rounded-lg flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-dark-100">{description}</p>
    </div>
  )
}

function MockSpreadsheet() {
  const fields = ['Name', 'Email', 'Status', 'Created']
  const rows = [
    ['Alice Johnson', 'alice@example.com', 'Active', '2024-01-15'],
    ['Bob Smith', 'bob@example.com', 'Pending', '2024-01-14'],
    ['Carol White', 'carol@example.com', 'Active', '2024-01-13'],
  ]

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-500 overflow-hidden shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 bg-dark-700 border-b border-dark-500">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span className="ml-4 text-sm text-dark-100">Customer Database</span>
      </div>
      <div className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-dark-700">
              {fields.map((field) => (
                <th key={field} className="px-4 py-3 text-left text-dark-100 font-medium border-b border-dark-500">
                  {field}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-dark-700/50 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3 text-white border-b border-dark-600">
                    {j === 2 ? (
                      <span className={`px-2 py-1 rounded-full text-xs ${cell === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {cell}
                      </span>
                    ) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MockFilter() {
  return (
    <div className="bg-dark-800 rounded-lg border border-dark-500 p-4 shadow-xl">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span className="text-white font-medium">Smart Filtering</span>
      </div>
      <code className="block bg-dark-700 rounded px-3 py-2 text-sm text-accent font-mono">
        status = "Active" AND created &gt; "2024-01-01"
      </code>
    </div>
  )
}

function MockAI() {
  return (
    <div className="bg-dark-800 rounded-lg border border-dark-500 p-4 shadow-xl">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <span className="text-white font-medium">AI Insights</span>
      </div>
      <p className="text-sm text-dark-100">
        "Your database shows 73% active users with a 15% increase this month. Consider adding a 'last_login' field for better engagement tracking."
      </p>
    </div>
  )
}

function FloatingShape({ className }: { className: string }) {
  return (
    <div className={`absolute rounded-full blur-3xl opacity-20 ${className}`} />
  )
}

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount / 100)
}

function PricingSection() {
  const { data: plans, isLoading } = usePlans()
  const [interval, setInterval] = useState<'month' | 'year'>('month')

  if (isLoading || !plans) return null

  const monthlyPrices = plans.pro.prices.filter((p: StripePrice) => p.interval === 'month')
  const yearlyPrices = plans.pro.prices.filter((p: StripePrice) => p.interval === 'year')
  const activePrices = interval === 'year' ? yearlyPrices : monthlyPrices
  const hasToggle = monthlyPrices.length > 0 && yearlyPrices.length > 0

  return (
    <section id="pricing" className="relative z-10 px-6 py-24">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Simple, transparent pricing</h2>
          <p className="text-xl text-dark-100 max-w-2xl mx-auto">
            Start free and upgrade when you need more power.
          </p>
        </div>

        {hasToggle && (
          <div className="flex justify-center gap-2 mb-10">
            <button
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                interval === 'month' ? 'bg-accent text-white' : 'bg-dark-700 text-dark-100 hover:text-white'
              }`}
              onClick={() => setInterval('month')}
            >
              Monthly
            </button>
            <button
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                interval === 'year' ? 'bg-accent text-white' : 'bg-dark-700 text-dark-100 hover:text-white'
              }`}
              onClick={() => setInterval('year')}
            >
              Annual
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Free card */}
          <div className="bg-dark-700/50 backdrop-blur border border-dark-500 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-white mb-2">Free</h3>
            <div className="text-4xl font-bold text-white mb-1">
              $0<span className="text-base font-normal text-dark-100">/month</span>
            </div>
            <p className="text-dark-100 mb-6">For individuals getting started</p>
            <ul className="space-y-3 text-sm text-dark-100 mb-8">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Up to {plans.free.limits.max_databases} databases
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Up to {plans.free.limits.max_entries_per_db} entries per database
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Up to {plans.free.limits.max_fields_per_db} fields per database
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Up to {plans.free.limits.max_members} team members
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {plans.free.limits.ai_queries_per_day} AI queries per day
              </li>
            </ul>
            <Link
              to="/register"
              className="block w-full text-center px-6 py-3 bg-dark-600 text-white rounded-xl font-medium hover:bg-dark-500 transition-colors"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro card */}
          <div className="bg-dark-700/50 backdrop-blur border border-accent/50 rounded-2xl p-8 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent text-white text-xs font-semibold rounded-full">
              POPULAR
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
            {activePrices.length > 0 ? (
              <div className="text-4xl font-bold text-white mb-1">
                {formatPrice(activePrices[0].unit_amount, activePrices[0].currency)}
                <span className="text-base font-normal text-dark-100">/{activePrices[0].interval}</span>
              </div>
            ) : (
              <div className="text-4xl font-bold text-white mb-1">
                Pro<span className="text-base font-normal text-dark-100"> pricing</span>
              </div>
            )}
            {interval === 'year' && activePrices.length > 0 && (
              <p className="text-sm text-dark-200 mb-1">
                {formatPrice(Math.round(activePrices[0].unit_amount / 12), activePrices[0].currency)}/month equivalent
              </p>
            )}
            <p className="text-dark-100 mb-6">For teams that need more</p>
            <ul className="space-y-3 text-sm text-dark-100 mb-8">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-accent flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Unlimited databases
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-accent flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Unlimited entries per database
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-accent flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Unlimited fields per database
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-accent flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Unlimited team members
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-accent flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Unlimited AI queries
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-accent flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Unlimited visualizations
              </li>
            </ul>
            <Link
              to="/register"
              className="block w-full text-center px-6 py-3 bg-gradient-to-r from-accent to-purple-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function LandingPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <div className="min-h-screen bg-dark-900 overflow-hidden">
      {/* Floating background shapes */}
      <FloatingShape className="w-96 h-96 bg-accent top-20 -left-48 animate-pulse" />
      <FloatingShape className="w-80 h-80 bg-purple-500 top-40 right-20" />
      <FloatingShape className="w-64 h-64 bg-pink-500 bottom-40 left-1/3" />

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-accent to-purple-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">DataDabble</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="px-5 py-2 bg-gradient-to-r from-accent to-purple-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                Open App
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-dark-100 hover:text-white transition-colors">
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2 bg-gradient-to-r from-accent to-purple-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-20 pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/30 rounded-full text-accent text-sm mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </span>
                Now with AI-powered insights
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                Build databases
                <span className="block bg-gradient-to-r from-accent to-purple-500 bg-clip-text text-transparent">
                  without limits
                </span>
              </h1>
              <p className="text-xl text-dark-100 mb-8 leading-relaxed">
                Create custom databases with flexible schemas, powerful filtering, team collaboration, and AI-driven insights. No SQL knowledge required.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/register"
                  className="px-8 py-4 bg-gradient-to-r from-accent to-purple-500 text-white rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-accent/25"
                >
                  Start Building Free
                </Link>
                <a
                  href="#features"
                  className="px-8 py-4 bg-dark-700 text-white rounded-xl font-semibold text-lg hover:bg-dark-600 transition-colors border border-dark-500"
                >
                  See Features
                </a>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-dark-100">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Free forever plan
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  No credit card required
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-purple-500/20 rounded-2xl blur-2xl" />
              <div className="relative">
                <MockSpreadsheet />
                <div className="absolute -bottom-8 -left-8 w-72">
                  <MockFilter />
                </div>
                <div className="absolute -top-4 -right-4 w-80">
                  <MockAI />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 px-6 py-24 bg-dark-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Everything you need to manage data</h2>
            <p className="text-xl text-dark-100 max-w-2xl mx-auto">
              Powerful features that make database management a breeze, whether you're a solo creator or a growing team.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              }
              title="Flexible Schemas"
              description="Define custom fields with 9+ data types including text, numbers, dates, booleans, URLs, and JSON. Modify schemas anytime without data loss."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              }
              title="Spreadsheet View"
              description="Edit data in a familiar spreadsheet interface with keyboard navigation, resizable columns, and inline editing. Just like Excel, but better."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              }
              title="Advanced Filtering"
              description="Query your data with powerful expressions. Use AND/OR logic, comparisons, text search, and grouping. Visual builder or write expressions directly."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
              title="Team Collaboration"
              description="Invite team members with role-based permissions. Admins manage everything, members focus on data entry. Full audit trail included."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              }
              title="AI-Powered Insights"
              description="Get intelligent analysis of your data patterns, quality issues, and actionable suggestions. Ask questions in plain English and get instant answers."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              title="Visualizations"
              description="Create beautiful charts from your data. Bar charts, line graphs, and pie charts with multi-database support. Share insights at a glance."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              title="Export Anything"
              description="Export data to CSV or generate SQL schemas for MySQL, PostgreSQL, SQLite, SQL Server, or Prisma. Take your data anywhere."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              }
              title="Audit Trail"
              description="Track every change with detailed logs. See who modified what, when, and the exact changes made. Export audit logs for compliance."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              }
              title="Drag & Drop"
              description="Reorder fields with simple drag and drop. Organize your schema exactly how you want it. Changes reflect instantly everywhere."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* CTA Section */}
      <section className="relative z-10 px-6 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to build something amazing?
          </h2>
          <p className="text-xl text-dark-100 mb-8">
            Join thousands of teams using DataDabble to manage their data effortlessly.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-accent to-purple-500 text-white rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-accent/25"
          >
            Get Started Free
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 border-t border-dark-700">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-purple-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-white">DataDabble</span>
          </div>
          <p className="text-dark-200 text-sm">
            Built with care. Your data, your way.
          </p>
        </div>
      </footer>
    </div>
  )
}
