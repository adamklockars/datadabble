import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getScopes,
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  rotateSecret,
} from '../api/developer'
import type { CreateClientData, UpdateClientData } from '../types/developer'

export function useScopes() {
  return useQuery({
    queryKey: ['developer', 'scopes'],
    queryFn: getScopes,
  })
}

export function useClients() {
  return useQuery({
    queryKey: ['developer', 'clients'],
    queryFn: getClients,
  })
}

export function useClient(clientId: string) {
  return useQuery({
    queryKey: ['developer', 'clients', clientId],
    queryFn: () => getClient(clientId),
    enabled: !!clientId,
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateClientData) => createClient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer', 'clients'] })
    },
  })
}

export function useUpdateClient(clientId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateClientData) => updateClient(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer', 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['developer', 'clients', clientId] })
    },
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer', 'clients'] })
    },
  })
}

export function useRotateSecret() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: rotateSecret,
    onSuccess: (_, clientId) => {
      queryClient.invalidateQueries({ queryKey: ['developer', 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['developer', 'clients', clientId] })
    },
  })
}
