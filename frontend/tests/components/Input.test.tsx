import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Input from '../../src/components/ui/Input'

describe('Input', () => {
  it('renders without label', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('renders with label', () => {
    render(<Input label="Email" placeholder="Enter email" />)
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument()
  })

  it('shows error message', () => {
    render(<Input error="This field is required" />)
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('applies error styles when error is present', () => {
    render(<Input error="Error" />)
    expect(screen.getByRole('textbox')).toHaveClass('border-red-500')
  })

  it('calls onChange when value changes', () => {
    const handleChange = vi.fn()
    render(<Input onChange={handleChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    expect(handleChange).toHaveBeenCalled()
  })

  it('supports different input types', () => {
    render(<Input type="password" data-testid="password-input" />)
    expect(screen.getByTestId('password-input')).toHaveAttribute('type', 'password')
  })
})
