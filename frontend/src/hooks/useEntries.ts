import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEntries, createEntry, updateEntry, deleteEntry } from '../api'

export function useEntries(databaseSlug: string, page = 1, perPage = 20, filter = '') {
  return useQuery({
    queryKey: ['entries', databaseSlug, page, perPage, filter],
    queryFn: () => getEntries(databaseSlug, { page, perPage, filter }),
    enabled: !!databaseSlug,
  })
}

export function useCreateEntry(databaseSlug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { values: Record<string, unknown> }) => createEntry(databaseSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', databaseSlug] })
    },
  })
}

export function useUpdateEntry(databaseSlug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ entryId, data }: { entryId: string; data: { values: Record<string, unknown> } }) =>
      updateEntry(databaseSlug, entryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', databaseSlug] })
    },
  })
}

export function useDeleteEntry(databaseSlug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (entryId: string) => deleteEntry(databaseSlug, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', databaseSlug] })
    },
  })
}
