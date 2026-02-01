import apiClient from './client'
import type { AuthResponse, User } from '../types'

interface RegisterData {
  email: string
  password: string
  first_name?: string
  last_name?: string
}

interface LoginData {
  email: string
  password: string
}

export async function register(data: RegisterData): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/register', data)
  return response.data
}

export async function login(data: LoginData): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', data)
  return response.data
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function refreshToken(): Promise<{ access_token: string }> {
  const response = await apiClient.post<{ access_token: string }>('/auth/refresh')
  return response.data
}

export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<User>('/auth/me')
  return response.data
}
