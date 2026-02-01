import apiClient from './client'
import type { Entry, Pagination } from '../types'

interface EntriesResponse {
  entries: Entry[]
  pagination: Pagination
}

interface CreateEntryData {
  values: Record<string, unknown>
}

interface UpdateEntryData {
  values: Record<string, unknown>
}

export async function getEntries(databaseSlug: string, page = 1, perPage = 20): Promise<EntriesResponse> {
  const response = await apiClient.get<EntriesResponse>(`/databases/${databaseSlug}/entries`, {
    params: { page, per_page: perPage },
  })
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
