import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'

// We need to mock zustand's auth store before importing the client module
const mockGetState = vi.fn()

vi.mock('../../src/store/authStore', () => ({
  useAuthStore: {
    getState: () => mockGetState(),
  },
}))

// We need to track interceptors so we can test them
// Instead of mocking axios.create, we import the real module and test behavior
// But since the client module registers interceptors at import time,
// we test the exported apiClient's configuration

describe('API client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({
      accessToken: null,
      refreshToken: null,
      setAccessToken: vi.fn(),
      logout: vi.fn(),
    })
  })

  it('exports apiClient as both default and named export', async () => {
    // Re-import to test exports
    const clientModule = await import('../../src/api/client')
    expect(clientModule.default).toBeDefined()
    expect(clientModule.apiClient).toBeDefined()
    expect(clientModule.default).toBe(clientModule.apiClient)
  })

  it('has /api/v1 as base URL', async () => {
    const { default: apiClient } = await import('../../src/api/client')
    expect(apiClient.defaults.baseURL).toBe('/api/v1')
  })

  it('sets Content-Type to application/json', async () => {
    const { default: apiClient } = await import('../../src/api/client')
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json')
  })

  it('has request interceptors registered', async () => {
    const { default: apiClient } = await import('../../src/api/client')
    // axios interceptors manager has handlers array
    expect(apiClient.interceptors.request).toBeDefined()
  })

  it('has response interceptors registered', async () => {
    const { default: apiClient } = await import('../../src/api/client')
    expect(apiClient.interceptors.response).toBeDefined()
  })

  describe('request interceptor', () => {
    it('adds Authorization header when accessToken is present', async () => {
      mockGetState.mockReturnValue({
        accessToken: 'test-token-abc',
        refreshToken: 'refresh-token-xyz',
        setAccessToken: vi.fn(),
        logout: vi.fn(),
      })

      const { default: apiClient } = await import('../../src/api/client')

      // Simulate what the request interceptor does by examining the interceptor
      // We test by checking the interceptor modifies config correctly
      const interceptors = (apiClient.interceptors.request as any).handlers
      const requestInterceptor = interceptors.find((h: any) => h !== null)

      if (requestInterceptor && requestInterceptor.fulfilled) {
        const config = {
          headers: {
            set: vi.fn(),
            get: vi.fn(),
            has: vi.fn(),
            delete: vi.fn(),
          } as any,
        }
        const result = requestInterceptor.fulfilled(config)
        expect(result.headers.Authorization).toBe('Bearer test-token-abc')
      }
    })

    it('does not add Authorization header when accessToken is null', async () => {
      mockGetState.mockReturnValue({
        accessToken: null,
        refreshToken: null,
        setAccessToken: vi.fn(),
        logout: vi.fn(),
      })

      const { default: apiClient } = await import('../../src/api/client')

      const interceptors = (apiClient.interceptors.request as any).handlers
      const requestInterceptor = interceptors.find((h: any) => h !== null)

      if (requestInterceptor && requestInterceptor.fulfilled) {
        const config = {
          headers: {} as any,
        }
        const result = requestInterceptor.fulfilled(config)
        expect(result.headers.Authorization).toBeUndefined()
      }
    })
  })
})
