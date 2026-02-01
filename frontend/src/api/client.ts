import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/authStore'

const API_BASE_URL = '/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = useAuthStore.getState().accessToken
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // If 401 and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshToken = useAuthStore.getState().refreshToken

      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, null, {
            headers: {
              Authorization: `Bearer ${refreshToken}`,
            },
          })

          const newAccessToken = response.data.access_token
          useAuthStore.getState().setAccessToken(newAccessToken)

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          return apiClient(originalRequest)
        } catch (refreshError) {
          // Refresh failed, logout
          useAuthStore.getState().logout()
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      } else {
        // No refresh token, logout
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
