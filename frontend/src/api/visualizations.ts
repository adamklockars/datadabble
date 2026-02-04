import apiClient from './client'
import type { Visualization, VisualizationData } from '../types'

interface CreateVisualizationData {
  title: string
  chart_type: 'bar' | 'line' | 'pie'
  database_slugs: string[]
  x_field: string
  y_field?: string
  aggregation?: 'count' | 'sum'
}

interface UpdateVisualizationData {
  title?: string
  chart_type?: 'bar' | 'line' | 'pie'
  database_slugs?: string[]
  x_field?: string
  y_field?: string
  aggregation?: 'count' | 'sum'
}

interface AdHocDataParams {
  database_slugs: string[]
  x_field: string
  y_field?: string
  aggregation?: 'count' | 'sum'
}

export async function getVisualizations(): Promise<Visualization[]> {
  const response = await apiClient.get<Visualization[]>('/visualizations')
  return response.data
}

export async function getVisualization(id: string): Promise<Visualization> {
  const response = await apiClient.get<Visualization>(`/visualizations/${id}`)
  return response.data
}

export async function createVisualization(data: CreateVisualizationData): Promise<{ message: string; visualization: Visualization }> {
  const response = await apiClient.post<{ message: string; visualization: Visualization }>('/visualizations', data)
  return response.data
}

export async function updateVisualization(id: string, data: UpdateVisualizationData): Promise<{ message: string; visualization: Visualization }> {
  const response = await apiClient.put<{ message: string; visualization: Visualization }>(`/visualizations/${id}`, data)
  return response.data
}

export async function deleteVisualization(id: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/visualizations/${id}`)
  return response.data
}

export async function getVisualizationData(id: string): Promise<VisualizationData> {
  const response = await apiClient.get<VisualizationData>(`/visualizations/${id}/data`)
  return response.data
}

export async function getAdHocVisualizationData(params: AdHocDataParams): Promise<Pick<VisualizationData, 'labels' | 'series'>> {
  const response = await apiClient.post<Pick<VisualizationData, 'labels' | 'series'>>('/visualizations/data', params)
  return response.data
}
