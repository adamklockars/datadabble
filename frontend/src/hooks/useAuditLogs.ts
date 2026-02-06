import { useQuery } from '@tanstack/react-query'
import { getAccountAuditLogs, getAccountAuditUsers, getAccountAuditStats } from '../api/accountAudit'
import type { AuditLogFilters } from '../api/accountAudit'

export function useAccountAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: ['accountAuditLogs', filters],
    queryFn: () => getAccountAuditLogs(filters),
  })
}

export function useAccountAuditUsers() {
  return useQuery({
    queryKey: ['accountAuditUsers'],
    queryFn: getAccountAuditUsers,
  })
}

export function useAccountAuditStats() {
  return useQuery({
    queryKey: ['accountAuditStats'],
    queryFn: getAccountAuditStats,
  })
}
