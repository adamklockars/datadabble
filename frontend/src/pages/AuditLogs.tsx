import { useState } from 'react'
import { useAccountAuditLogs, useAccountAuditUsers, useAccountAuditStats } from '../hooks/useAuditLogs'
import { exportAccountAuditLogs } from '../api/accountAudit'
import type { AuditLogFilters, AuditLog } from '../api/accountAudit'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'

const ACTION_OPTIONS = [
  'DATABASE_CREATED', 'DATABASE_UPDATED', 'DATABASE_DELETED',
  'FIELD_CREATED', 'FIELD_UPDATED', 'FIELD_DELETED', 'FIELD_REORDERED',
  'ENTRY_CREATED', 'ENTRY_UPDATED', 'ENTRY_DELETED',
]

const RESOURCE_TYPE_OPTIONS = ['database', 'field', 'entry']

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

export default function AuditLogs() {
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, per_page: 50 })
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useAccountAuditLogs(filters)
  const { data: users = [] } = useAccountAuditUsers()
  const { data: stats } = useAccountAuditStats()

  const updateFilter = (key: keyof AuditLogFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined, page: 1 }))
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await exportAccountAuditLogs(filters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'audit-logs.csv'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
        <Button onClick={handleExport} loading={exporting} variant="secondary">
          Export CSV
        </Button>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-dark-700 rounded-lg p-4">
            <div className="text-sm text-dark-100">Total Events</div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-dark-700 rounded-lg p-4">
            <div className="text-sm text-dark-100">Databases</div>
            <div className="text-2xl font-bold text-white">{Object.keys(stats.by_database).length}</div>
          </div>
          <div className="bg-dark-700 rounded-lg p-4">
            <div className="text-sm text-dark-100">Users</div>
            <div className="text-2xl font-bold text-white">{Object.keys(stats.by_user).length}</div>
          </div>
          <div className="bg-dark-700 rounded-lg p-4">
            <div className="text-sm text-dark-100">Action Types</div>
            <div className="text-2xl font-bold text-white">{Object.keys(stats.by_action).length}</div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-dark-700 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            className="bg-dark-600 border border-dark-400 rounded-md px-3 py-2 text-sm text-white"
            value={filters.user_email || ''}
            onChange={e => updateFilter('user_email', e.target.value)}
          >
            <option value="">All Users</option>
            {users.map(email => (
              <option key={email} value={email}>{email}</option>
            ))}
          </select>

          <select
            className="bg-dark-600 border border-dark-400 rounded-md px-3 py-2 text-sm text-white"
            value={filters.action || ''}
            onChange={e => updateFilter('action', e.target.value)}
          >
            <option value="">All Actions</option>
            {ACTION_OPTIONS.map(action => (
              <option key={action} value={action}>{formatAction(action)}</option>
            ))}
          </select>

          <select
            className="bg-dark-600 border border-dark-400 rounded-md px-3 py-2 text-sm text-white"
            value={filters.resource_type || ''}
            onChange={e => updateFilter('resource_type', e.target.value)}
          >
            <option value="">All Resource Types</option>
            {RESOURCE_TYPE_OPTIONS.map(rt => (
              <option key={rt} value={rt}>{rt.charAt(0).toUpperCase() + rt.slice(1)}</option>
            ))}
          </select>

          <select
            className="bg-dark-600 border border-dark-400 rounded-md px-3 py-2 text-sm text-white"
            value={filters.database_slug || ''}
            onChange={e => updateFilter('database_slug', e.target.value)}
          >
            <option value="">All Databases</option>
            {stats && Object.keys(stats.by_database).sort().map(slug => (
              <option key={slug} value={slug}>{slug}</option>
            ))}
          </select>

          <input
            type="date"
            className="bg-dark-600 border border-dark-400 rounded-md px-3 py-2 text-sm text-white"
            value={filters.date_from || ''}
            onChange={e => updateFilter('date_from', e.target.value)}
            placeholder="From date"
          />

          <input
            type="date"
            className="bg-dark-600 border border-dark-400 rounded-md px-3 py-2 text-sm text-white"
            value={filters.date_to || ''}
            onChange={e => updateFilter('date_to', e.target.value)}
            placeholder="To date"
          />
        </div>
      </div>

      {/* Results Table */}
      {isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="bg-dark-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-400">
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-100 uppercase">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-100 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-100 uppercase">Database</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-100 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-100 uppercase">Resource</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-100 uppercase">Details</th>
                </tr>
              </thead>
              <tbody>
                {data?.audit_logs.map(log => (
                  <tr
                    key={log.id}
                    className="border-b border-dark-600 hover:bg-dark-600 cursor-pointer transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-3 text-sm text-dark-100 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{log.user_email}</td>
                    <td className="px-4 py-3 text-sm text-dark-100">{log.database_slug}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        log.action.includes('CREATED') ? 'bg-green-900/30 text-green-400' :
                        log.action.includes('UPDATED') ? 'bg-blue-900/30 text-blue-400' :
                        log.action.includes('DELETED') ? 'bg-red-900/30 text-red-400' :
                        'bg-dark-500 text-dark-100'
                      }`}>
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {log.resource_name || log.resource_type}
                    </td>
                    <td className="px-4 py-3 text-sm text-dark-100 max-w-xs truncate">
                      {log.details}
                    </td>
                  </tr>
                ))}
                {data?.audit_logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-dark-100">
                      No audit logs found matching the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-dark-100">
                Showing {((data.pagination.page - 1) * data.pagination.per_page) + 1} to{' '}
                {Math.min(data.pagination.page * data.pagination.per_page, data.pagination.total)} of{' '}
                {data.pagination.total} results
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={data.pagination.page <= 1}
                  onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={data.pagination.page >= data.pagination.pages}
                  onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedLog(null)}>
          <div className="bg-dark-700 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold text-white">Audit Log Detail</h2>
              <button onClick={() => setSelectedLog(null)} className="text-dark-100 hover:text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs text-dark-100 uppercase">Timestamp</div>
                <div className="text-sm text-white">{formatDate(selectedLog.created_at)}</div>
              </div>
              <div>
                <div className="text-xs text-dark-100 uppercase">User</div>
                <div className="text-sm text-white">{selectedLog.user_email}</div>
              </div>
              <div>
                <div className="text-xs text-dark-100 uppercase">Database</div>
                <div className="text-sm text-white">{selectedLog.database_slug}</div>
              </div>
              <div>
                <div className="text-xs text-dark-100 uppercase">Action</div>
                <div className="text-sm text-white">{formatAction(selectedLog.action)}</div>
              </div>
              <div>
                <div className="text-xs text-dark-100 uppercase">Resource</div>
                <div className="text-sm text-white">{selectedLog.resource_type} - {selectedLog.resource_name || selectedLog.resource_id}</div>
              </div>
              {selectedLog.details && (
                <div>
                  <div className="text-xs text-dark-100 uppercase">Details</div>
                  <div className="text-sm text-white">{selectedLog.details}</div>
                </div>
              )}
              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div>
                  <div className="text-xs text-dark-100 uppercase mb-2">Changes</div>
                  <div className="bg-dark-600 rounded p-3 space-y-2">
                    {Object.entries(selectedLog.changes).map(([key, change]) => (
                      <div key={key} className="text-sm">
                        <span className="text-dark-100">{key}:</span>{' '}
                        <span className="text-red-400">{JSON.stringify(change.from)}</span>
                        {' -> '}
                        <span className="text-green-400">{JSON.stringify(change.to)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedLog.previous_state && (
                <div>
                  <div className="text-xs text-dark-100 uppercase mb-2">Previous State</div>
                  <pre className="bg-dark-600 rounded p-3 text-xs text-dark-100 overflow-x-auto">
                    {JSON.stringify(selectedLog.previous_state, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.new_state && (
                <div>
                  <div className="text-xs text-dark-100 uppercase mb-2">New State</div>
                  <pre className="bg-dark-600 rounded p-3 text-xs text-dark-100 overflow-x-auto">
                    {JSON.stringify(selectedLog.new_state, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
