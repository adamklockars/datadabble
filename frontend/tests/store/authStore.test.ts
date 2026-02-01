import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../../src/store/authStore'

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    })
  })

  it('has initial state', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.refreshToken).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('sets user', () => {
    const user = { id: '1', email: 'test@example.com', created_at: '', updated_at: '' }
    useAuthStore.getState().setUser(user)
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it('sets tokens and marks as authenticated', () => {
    useAuthStore.getState().setTokens('access-token', 'refresh-token')
    const state = useAuthStore.getState()
    expect(state.accessToken).toBe('access-token')
    expect(state.refreshToken).toBe('refresh-token')
    expect(state.isAuthenticated).toBe(true)
  })

  it('sets access token', () => {
    useAuthStore.getState().setAccessToken('new-access-token')
    expect(useAuthStore.getState().accessToken).toBe('new-access-token')
  })

  it('clears state on logout', () => {
    // Set up authenticated state
    useAuthStore.getState().setUser({ id: '1', email: 'test@example.com', created_at: '', updated_at: '' })
    useAuthStore.getState().setTokens('access', 'refresh')

    // Logout
    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.refreshToken).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })
})
