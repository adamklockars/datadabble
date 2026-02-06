import { useState } from 'react'
import { useClients, useScopes, useCreateClient, useDeleteClient, useRotateSecret } from '../hooks/useDeveloper'
import type { OAuthClient, OAuthClientWithSecret, CreateClientData } from '../types/developer'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="text-xs text-dark-100 hover:text-accent ml-2"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function SecretBanner({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  return (
    <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-yellow-400 mb-1">Save your client secret</h3>
          <p className="text-xs text-yellow-200 mb-2">This secret will not be shown again. Store it securely.</p>
          <div className="flex items-center">
            <code className="text-xs bg-dark-900 px-2 py-1 rounded text-white break-all">{secret}</code>
            <CopyButton text={secret} />
          </div>
        </div>
        <button onClick={onDismiss} className="text-yellow-400 hover:text-yellow-200 ml-4">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function CreateClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (client: OAuthClientWithSecret) => void
}) {
  const { data: scopes = [] } = useScopes()
  const createClient = useCreateClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [redirectUris, setRedirectUris] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: CreateClientData = {
      name,
      description,
      redirect_uris: redirectUris.split('\n').map((u) => u.trim()).filter(Boolean),
      scopes: selectedScopes,
    }
    const result = await createClient.mutateAsync(payload)
    onCreated(result.client)
  }

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-700 border border-dark-400 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-white mb-4">Create OAuth Application</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1">Application Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-dark-900 border border-dark-400 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
              placeholder="My App"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-dark-900 border border-dark-400 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
              rows={2}
              placeholder="What does your app do?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1">Redirect URIs (one per line)</label>
            <textarea
              value={redirectUris}
              onChange={(e) => setRedirectUris(e.target.value)}
              className="w-full bg-dark-900 border border-dark-400 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-accent"
              rows={3}
              placeholder="https://myapp.com/callback"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-2">Scopes</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {scopes.map((scope) => (
                <label key={scope.name} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope.name)}
                    onChange={() => toggleScope(scope.name)}
                    className="mt-0.5"
                  />
                  <div>
                    <code className="text-xs text-accent">{scope.name}</code>
                    <p className="text-xs text-dark-100">{scope.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={createClient.isPending || !name}
              className="px-4 py-2 bg-accent text-dark-900 rounded text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
            >
              {createClient.isPending ? 'Creating...' : 'Create Application'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-dark-600 text-dark-100 rounded text-sm hover:bg-dark-500"
            >
              Cancel
            </button>
          </div>
          {createClient.isError && (
            <p className="text-sm text-red-400">Failed to create client. Please try again.</p>
          )}
        </form>
      </div>
    </div>
  )
}

function ClientRow({
  client,
  onSelect,
}: {
  client: OAuthClient
  onSelect: (client: OAuthClient) => void
}) {
  return (
    <div
      onClick={() => onSelect(client)}
      className="bg-dark-700 border border-dark-400 rounded-lg p-4 hover:border-dark-300 cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{client.name}</h3>
          {client.description && (
            <p className="text-xs text-dark-100 mt-1">{client.description}</p>
          )}
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            client.active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
          }`}
        >
          {client.active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-dark-100">
        <span>
          Client ID: <code className="text-white">{client.client_id.slice(0, 8)}...</code>
        </span>
        <span>{client.scopes.length} scopes</span>
        <span>{new Date(client.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

function ClientDetail({
  client,
  onClose,
}: {
  client: OAuthClient
  onClose: () => void
}) {
  const deleteClientMutation = useDeleteClient()
  const rotateSecretMutation = useRotateSecret()
  const [newSecret, setNewSecret] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!confirm(`Delete "${client.name}"? This will revoke all tokens.`)) return
    await deleteClientMutation.mutateAsync(client.client_id)
    onClose()
  }

  const handleRotate = async () => {
    if (!confirm('Rotate secret? Existing tokens will be revoked.')) return
    const result = await rotateSecretMutation.mutateAsync(client.client_id)
    setNewSecret(result.client_secret)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-700 border border-dark-400 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">{client.name}</h2>
          <button onClick={onClose} className="text-dark-100 hover:text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {newSecret && (
          <SecretBanner secret={newSecret} onDismiss={() => setNewSecret(null)} />
        )}

        {client.description && (
          <p className="text-sm text-dark-100 mb-4">{client.description}</p>
        )}

        <div className="space-y-3 mb-6">
          <div>
            <label className="text-xs text-dark-100">Client ID</label>
            <div className="flex items-center">
              <code className="text-sm text-white bg-dark-900 px-2 py-1 rounded break-all">{client.client_id}</code>
              <CopyButton text={client.client_id} />
            </div>
          </div>
          <div>
            <label className="text-xs text-dark-100">Status</label>
            <p className={`text-sm ${client.active ? 'text-green-400' : 'text-red-400'}`}>
              {client.active ? 'Active' : 'Inactive'}
            </p>
          </div>
          <div>
            <label className="text-xs text-dark-100">Redirect URIs</label>
            {(client.redirect_uris || []).length > 0 ? (
              <ul className="text-sm text-white space-y-1">
                {client.redirect_uris.map((uri) => (
                  <li key={uri} className="font-mono text-xs bg-dark-900 px-2 py-1 rounded">{uri}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-dark-100">None configured</p>
            )}
          </div>
          <div>
            <label className="text-xs text-dark-100">Scopes</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {(client.scopes || []).map((scope) => (
                <span key={scope} className="text-xs bg-dark-900 text-accent px-2 py-0.5 rounded">{scope}</span>
              ))}
              {(client.scopes || []).length === 0 && (
                <span className="text-sm text-dark-100">None</span>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-dark-100">Created</label>
            <p className="text-sm text-white">{new Date(client.created_at).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex gap-3 border-t border-dark-400 pt-4">
          <button
            onClick={handleRotate}
            disabled={rotateSecretMutation.isPending}
            className="px-3 py-2 bg-dark-600 text-dark-100 rounded text-sm hover:bg-dark-500 disabled:opacity-50"
          >
            {rotateSecretMutation.isPending ? 'Rotating...' : 'Rotate Secret'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteClientMutation.isPending}
            className="px-3 py-2 bg-red-900/30 text-red-400 rounded text-sm hover:bg-red-900/50 disabled:opacity-50"
          >
            {deleteClientMutation.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DeveloperClients() {
  const { data: clients = [], isLoading } = useClients()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedClient, setSelectedClient] = useState<OAuthClient | null>(null)
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(null)

  const handleCreated = (client: OAuthClientWithSecret) => {
    setShowCreate(false)
    setNewlyCreatedSecret(client.client_secret)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">OAuth Applications</h1>
          <p className="text-sm text-dark-100 mt-1">Manage your registered OAuth clients</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-accent text-dark-900 rounded text-sm font-medium hover:bg-accent/90"
        >
          Create New App
        </button>
      </div>

      {newlyCreatedSecret && (
        <SecretBanner secret={newlyCreatedSecret} onDismiss={() => setNewlyCreatedSecret(null)} />
      )}

      {isLoading ? (
        <div className="text-dark-100 text-center py-12">Loading clients...</div>
      ) : clients.length === 0 ? (
        <div className="text-center py-12 bg-dark-700 border border-dark-400 rounded-lg">
          <svg className="h-12 w-12 text-dark-100 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <p className="text-dark-100 mb-4">No OAuth applications yet</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-accent text-dark-900 rounded text-sm font-medium hover:bg-accent/90"
          >
            Create Your First App
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <ClientRow key={client.id} client={client} onSelect={setSelectedClient} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateClientModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      {selectedClient && (
        <ClientDetail client={selectedClient} onClose={() => setSelectedClient(null)} />
      )}
    </div>
  )
}
