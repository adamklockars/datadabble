import apiClient from './client'
import type { Field, FieldType } from '../types'

interface CreateFieldData {
  name: string
  field_type: FieldType
  required?: boolean
  default_value?: unknown
  order?: number
}

interface UpdateFieldData {
  name?: string
  field_type?: FieldType
  required?: boolean
  default_value?: unknown
  order?: number
  confirm_data_loss?: boolean
}

export interface TypeChangeAnalysis {
  total_entries: number
  entries_with_value: number
  convertible: number
  will_lose_data: number
  affected_entries: Array<{ entry_id: string; current_value: string }>
}

export async function getFields(databaseSlug: string): Promise<Field[]> {
  const response = await apiClient.get<Field[]>(`/databases/${databaseSlug}/fields`)
  return response.data
}

export async function getField(databaseSlug: string, fieldId: string): Promise<Field> {
  const response = await apiClient.get<Field>(`/databases/${databaseSlug}/fields/${fieldId}`)
  return response.data
}

export async function createField(databaseSlug: string, data: CreateFieldData): Promise<{ message: string; field: Field }> {
  const response = await apiClient.post<{ message: string; field: Field }>(`/databases/${databaseSlug}/fields`, data)
  return response.data
}

export async function updateField(databaseSlug: string, fieldId: string, data: UpdateFieldData): Promise<{ message: string; field: Field }> {
  const response = await apiClient.put<{ message: string; field: Field }>(`/databases/${databaseSlug}/fields/${fieldId}`, data)
  return response.data
}

export async function deleteField(databaseSlug: string, fieldId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/databases/${databaseSlug}/fields/${fieldId}`)
  return response.data
}

export async function previewTypeChange(
  databaseSlug: string,
  fieldId: string,
  newType: FieldType
): Promise<TypeChangeAnalysis> {
  const response = await apiClient.post<TypeChangeAnalysis>(
    `/databases/${databaseSlug}/fields/${fieldId}/preview-type-change`,
    { field_type: newType }
  )
  return response.data
}

export async function reorderFields(
  databaseSlug: string,
  fieldIds: string[]
): Promise<{ message: string; fields: Field[] }> {
  const response = await apiClient.post<{ message: string; fields: Field[] }>(
    `/databases/${databaseSlug}/fields/reorder`,
    { field_ids: fieldIds }
  )
  return response.data
}
