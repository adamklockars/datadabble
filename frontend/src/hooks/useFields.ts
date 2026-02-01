import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFields, createField, updateField, deleteField } from '../api'
import type { FieldType } from '../types'

export function useFields(databaseSlug: string) {
  return useQuery({
    queryKey: ['fields', databaseSlug],
    queryFn: () => getFields(databaseSlug),
    enabled: !!databaseSlug,
  })
}

export function useCreateField(databaseSlug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { name: string; field_type: FieldType; required?: boolean }) =>
      createField(databaseSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields', databaseSlug] })
    },
  })
}

export function useUpdateField(databaseSlug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ fieldId, data }: { fieldId: string; data: { name?: string; field_type?: FieldType; required?: boolean } }) =>
      updateField(databaseSlug, fieldId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields', databaseSlug] })
    },
  })
}

export function useDeleteField(databaseSlug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (fieldId: string) => deleteField(databaseSlug, fieldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields', databaseSlug] })
    },
  })
}
