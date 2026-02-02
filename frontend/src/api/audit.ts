import apiClient from './client'
import type { Pagination } from '../types'

export interface AuditLog {
  id: string
  created_at: string
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

export interface AuditLogsResponse {
  audit_logs: AuditLog[]
  pagination: Pagination
}

export interface AuditLogStats {
  total: number
  by_action: Record<string, number>
  by_resource: Record<string, number>
}

export async function getAuditLogs(
  databaseSlug: string,
  page = 1,
  perPage = 50,
  filters?: { action?: string; resource_type?: string }
): Promise<AuditLogsResponse> {
  const params: Record<string, string | number> = { page, per_page: perPage }
  if (filters?.action) params.action = filters.action
  if (filters?.resource_type) params.resource_type = filters.resource_type

  const response = await apiClient.get<AuditLogsResponse>(
    `/databases/${databaseSlug}/audit-logs`,
    { params }
  )
  return response.data
}

export async function getAuditLogStats(databaseSlug: string): Promise<AuditLogStats> {
  const response = await apiClient.get<AuditLogStats>(
    `/databases/${databaseSlug}/audit-logs/stats`
  )
  return response.data
}

export function getAuditLogExportUrl(databaseSlug: string): string {
  return `${apiClient.defaults.baseURL}/databases/${databaseSlug}/audit-logs/export`
}

export const ACTION_LABELS: Record<string, string> = {
  DATABASE_CREATED: 'Database Created',
  DATABASE_UPDATED: 'Database Updated',
  DATABASE_DELETED: 'Database Deleted',
  FIELD_CREATED: 'Field Created',
  FIELD_UPDATED: 'Field Updated',
  FIELD_DELETED: 'Field Deleted',
  FIELD_REORDERED: 'Fields Reordered',
  ENTRY_CREATED: 'Entry Created',
  ENTRY_UPDATED: 'Entry Updated',
  ENTRY_DELETED: 'Entry Deleted',
}

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  database: 'Database',
  field: 'Field',
  entry: 'Entry',
}
