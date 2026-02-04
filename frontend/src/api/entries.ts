import apiClient from './client'
import type { Entry, Pagination } from '../types'

interface EntriesResponse {
  entries: Entry[]
  pagination: Pagination
  filter?: string | null
}

interface CreateEntryData {
  values: Record<string, unknown>
}

interface UpdateEntryData {
  values: Record<string, unknown>
}

interface GetEntriesOptions {
  page?: number
  perPage?: number
  filter?: string
}

export async function getEntries(databaseSlug: string, options: GetEntriesOptions = {}): Promise<EntriesResponse> {
  const { page = 1, perPage = 20, filter } = options
  const params: Record<string, unknown> = { page, per_page: perPage }
  if (filter) {
    params.filter = filter
  }
  const response = await apiClient.get<EntriesResponse>(`/databases/${databaseSlug}/entries`, { params })
  return response.data
}

export async function validateFilter(databaseSlug: string, filter: string): Promise<{ valid: boolean; error?: string; ast?: unknown }> {
  const response = await apiClient.post<{ valid: boolean; error?: string; ast?: unknown }>(
    `/databases/${databaseSlug}/entries/validate-filter`,
    { filter }
  )
  return response.data
}

export async function getEntry(databaseSlug: string, entryId: string): Promise<Entry> {
  const response = await apiClient.get<Entry>(`/databases/${databaseSlug}/entries/${entryId}`)
  return response.data
}

export async function createEntry(databaseSlug: string, data: CreateEntryData): Promise<{ message: string; entry: Entry }> {
  const response = await apiClient.post<{ message: string; entry: Entry }>(`/databases/${databaseSlug}/entries`, data)
  return response.data
}

export async function updateEntry(databaseSlug: string, entryId: string, data: UpdateEntryData): Promise<{ message: string; entry: Entry }> {
  const response = await apiClient.put<{ message: string; entry: Entry }>(`/databases/${databaseSlug}/entries/${entryId}`, data)
  return response.data
}

export async function deleteEntry(databaseSlug: string, entryId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/databases/${databaseSlug}/entries/${entryId}`)
  return response.data
}
