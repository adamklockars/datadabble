import { apiClient } from './client'
import type { Pagination } from '../types'

export interface AuditLog {
  id: string
  created_at: string
  account_id: string | null
  database_id: string | null
  database_slug: string
  user_id: string | null
  user_email: string
  action: string
  resource_type: string
  resource_id: string | null
  resource_name: string | null
  previous_state: Record<string, unknown> | null
  new_state: Record<string, unknown> | null
  changes: Record<string, { from: unknown; to: unknown }> | null
  details: string | null
}

export interface AuditLogFilters {
  page?: number
  per_page?: number
  user_id?: string
  user_email?: string
  action?: string
  resource_type?: string
  database_slug?: string
  date_from?: string
  date_to?: string
}

export interface AuditLogStats {
  total: number
  by_action: Record<string, number>
  by_resource: Record<string, number>
  by_user: Record<string, number>
  by_database: Record<string, number>
}

export async function getAccountAuditLogs(filters: AuditLogFilters = {}): Promise<{
  audit_logs: AuditLog[]
  pagination: Pagination
}> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      params.append(key, String(value))
    }
  })
  const { data } = await apiClient.get(`/audit-logs?${params.toString()}`)
  return data
}

export async function exportAccountAuditLogs(filters: AuditLogFilters = {}): Promise<Blob> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      params.append(key, String(value))
    }
  })
  const { data } = await apiClient.get(`/audit-logs/export?${params.toString()}`, {
    responseType: 'blob',
  })
  return data
}

export async function getAccountAuditStats(): Promise<AuditLogStats> {
  const { data } = await apiClient.get('/audit-logs/stats')
  return data
}

export async function getAccountAuditUsers(): Promise<string[]> {
  const { data } = await apiClient.get('/audit-logs/users')
  return data.users
}
