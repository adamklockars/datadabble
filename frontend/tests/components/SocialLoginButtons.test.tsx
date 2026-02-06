import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../helpers/renderWithProviders'

const mockGetOAuthAuthorizeUrl = vi.fn()

vi.mock('../../src/api/oauth', () => ({
  getOAuthAuthorizeUrl: (...args: unknown[]) => mockGetOAuthAuthorizeUrl(...args),
}))

import SocialLoginButtons from '../../src/components/SocialLoginButtons'

describe('SocialLoginButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetOAuthAuthorizeUrl.mockResolvedValue({
      authorization_url: 'https://accounts.google.com/o/oauth2/auth',
      state: 'random-state',
    })
  })

  it('renders Google login button', () => {
    renderWithProviders(<SocialLoginButtons />)
    expect(screen.getByText('Google')).toBeInTheDocument()
  })

  it('renders GitHub login button', () => {
    renderWithProviders(<SocialLoginButtons />)
    expect(screen.getByText('GitHub')).toBeInTheDocument()
  })

  it('calls getOAuthAuthorizeUrl with correct provider on click', async () => {
    renderWithProviders(<SocialLoginButtons />)

    fireEvent.click(screen.getByText('Google'))

    await waitFor(() => {
      expect(mockGetOAuthAuthorizeUrl).toHaveBeenCalledWith('google')
    })
  })
})
