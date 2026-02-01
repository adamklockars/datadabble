export interface User {
  id: string
  email: string
  first_name?: string
  last_name?: string
  created_at: string
  updated_at: string
}

export interface Database {
  id: string
  title: string
  slug: string
  description?: string
  user_id: string
  fields?: Field[]
  created_at: string
  updated_at: string
}

export interface Field {
  id: string
  database_id: string
  name: string
  field_type: FieldType
  required: boolean
  default_value?: unknown
  order: number
  created_at: string
  updated_at: string
}

export type FieldType = 'BOOL' | 'INT' | 'DEC' | 'STR' | 'DATE' | 'EMAIL' | 'URL' | 'DICT' | 'LIST'

export interface Entry {
  id: string
  database_id: string
  values: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Pagination {
  page: number
  per_page: number
  total: number
  pages: number
}

export interface AuthResponse {
  message: string
  user: User
  access_token: string
  refresh_token: string
}

export interface ApiError {
  error: string
  message?: string
  messages?: Record<string, string[]>
}
