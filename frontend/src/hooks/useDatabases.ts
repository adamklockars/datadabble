import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDatabases, getDatabase, createDatabase, updateDatabase, deleteDatabase } from '../api'

export function useDatabases() {
  return useQuery({
    queryKey: ['databases'],
    queryFn: getDatabases,
  })
}

export function useDatabase(slug: string) {
  return useQuery({
    queryKey: ['database', slug],
    queryFn: () => getDatabase(slug),
    enabled: !!slug,
  })
}

export function useCreateDatabase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createDatabase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
    },
  })
}

export function useUpdateDatabase(slug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { title?: string; description?: string }) => updateDatabase(slug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
      queryClient.invalidateQueries({ queryKey: ['database', slug] })
    },
  })
}

export function useDeleteDatabase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteDatabase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
    },
  })
}
