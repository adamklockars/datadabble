import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getVisualizations,
  getVisualization,
  createVisualization,
  updateVisualization,
  deleteVisualization,
  getVisualizationData,
  getAdHocVisualizationData,
} from '../api/visualizations'

export function useVisualizations() {
  return useQuery({
    queryKey: ['visualizations'],
    queryFn: getVisualizations,
  })
}

export function useVisualization(id: string | undefined) {
  return useQuery({
    queryKey: ['visualization', id],
    queryFn: () => getVisualization(id!),
    enabled: !!id,
  })
}

export function useVisualizationData(id: string | undefined) {
  return useQuery({
    queryKey: ['visualizationData', id],
    queryFn: () => getVisualizationData(id!),
    enabled: !!id,
  })
}

export function useCreateVisualization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createVisualization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visualizations'] })
    },
  })
}

export function useUpdateVisualization(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof updateVisualization>[1]) => updateVisualization(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visualizations'] })
      queryClient.invalidateQueries({ queryKey: ['visualization', id] })
      queryClient.invalidateQueries({ queryKey: ['visualizationData', id] })
    },
  })
}

export function useDeleteVisualization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteVisualization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visualizations'] })
    },
  })
}

export function useAdHocVisualizationData() {
  return useMutation({
    mutationFn: getAdHocVisualizationData,
  })
}
