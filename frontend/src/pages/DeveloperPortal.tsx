import { Link } from 'react-router-dom'
import { useScopes } from '../hooks/useDeveloper'

export default function DeveloperPortal() {
  const { data: scopes = [] } = useScopes()

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Build with DataDabble API</h1>
        <p className="text-dark-100">
          Integrate your applications with DataDabble using our REST API and OAuth 2.0 authentication.
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          to="/developer/clients"
          className="bg-dark-700 border border-dark-400 rounded-lg p-6 hover:border-accent transition-colors"
        >
          <svg className="h-8 w-8 text-accent mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-1">OAuth Clients</h3>
          <p className="text-sm text-dark-100">Register and manage your OAuth applications</p>
        </Link>
        <a
          href="/api/docs/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-dark-700 border border-dark-400 rounded-lg p-6 hover:border-accent transition-colors"
        >
          <svg className="h-8 w-8 text-accent mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-1">API Documentation</h3>
          <p className="text-sm text-dark-100">Interactive Swagger UI with all endpoints</p>
        </a>
        <div className="bg-dark-700 border border-dark-400 rounded-lg p-6">
          <svg className="h-8 w-8 text-accent mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-1">Quick Start</h3>
          <p className="text-sm text-dark-100">Get up and running in minutes</p>
        </div>
      </div>

      {/* Quick Start Guide */}
      <div className="bg-dark-700 border border-dark-400 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Getting Started</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-accent mb-2">1. Create an OAuth Client</h3>
            <p className="text-sm text-dark-100 mb-2">
              Go to <Link to="/developer/clients" className="text-accent hover:underline">OAuth Clients</Link> and
              create a new application. You'll receive a <code className="bg-dark-900 px-1 rounded">client_id</code> and
              a <code className="bg-dark-900 px-1 rounded">client_secret</code>.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-accent mb-2">2. Authenticate with the API</h3>
            <p className="text-sm text-dark-100 mb-2">Use JWT authentication for direct API access:</p>
            <pre className="bg-dark-900 rounded p-3 text-xs text-dark-100 overflow-x-auto">
{`# Login and get token
curl -X POST /api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "you@example.com", "password": "yourpassword"}'

# Use the token
curl /api/v1/databases \\
  -H "Authorization: Bearer <access_token>"`}
            </pre>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-accent mb-2">3. Or use OAuth 2.0 for third-party apps</h3>
            <p className="text-sm text-dark-100 mb-2">
              Redirect users to the authorization endpoint, then exchange the code for tokens:
            </p>
            <pre className="bg-dark-900 rounded p-3 text-xs text-dark-100 overflow-x-auto">
{`# Step 1: Redirect user to authorize
GET /api/v1/oauth2/authorize?client_id=<id>&redirect_uri=<uri>&scope=read:databases&response_type=code

# Step 2: Exchange code for tokens
POST /api/v1/oauth2/token
{"grant_type": "authorization_code", "code": "<code>", "client_id": "<id>", "client_secret": "<secret>"}`}
            </pre>
          </div>
        </div>
      </div>

      {/* Available Scopes */}
      <div className="bg-dark-700 border border-dark-400 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Available Scopes</h2>
        <div className="space-y-2">
          {scopes.map((scope) => (
            <div key={scope.name} className="flex items-start gap-3 py-2 border-b border-dark-400 last:border-0">
              <code className="text-xs bg-dark-900 px-2 py-1 rounded text-accent whitespace-nowrap">
                {scope.name}
              </code>
              <span className="text-sm text-dark-100">{scope.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
