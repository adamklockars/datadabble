import apiClient from './client'
import type { Database } from '../types'

interface CreateDatabaseData {
  title: string
  description?: string
}

interface UpdateDatabaseData {
  title?: string
  description?: string
}

export async function getDatabases(): Promise<Database[]> {
  const response = await apiClient.get<Database[]>('/databases')
  return response.data
}

export async function getDatabase(slug: string): Promise<Database> {
  const response = await apiClient.get<Database>(`/databases/${slug}`)
  return response.data
}

export async function createDatabase(data: CreateDatabaseData): Promise<{ message: string; database: Database }> {
  const response = await apiClient.post<{ message: string; database: Database }>('/databases', data)
  return response.data
}

export async function updateDatabase(slug: string, data: UpdateDatabaseData): Promise<{ message: string; database: Database }> {
  const response = await apiClient.put<{ message: string; database: Database }>(`/databases/${slug}`, data)
  return response.data
}

export async function deleteDatabase(slug: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/databases/${slug}`)
  return response.data
}
