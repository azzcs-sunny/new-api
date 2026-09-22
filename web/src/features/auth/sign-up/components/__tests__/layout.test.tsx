/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { SignUpForm } from '../sign-up-form'

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({
    status: {
      email_verification: true,
      oauth_register_enabled: false,
    },
  }),
}))

vi.mock('@/features/auth/hooks/use-auth-redirect', () => ({
  useAuthRedirect: () => ({
    redirectToLogin: vi.fn(),
    handleLoginResult: vi.fn(),
  }),
}))

vi.mock('@/features/auth/hooks/use-email-verification', () => ({
  useEmailVerification: () => ({
    isSending: false,
    secondsLeft: 0,
    isActive: false,
    sendCode: vi.fn(),
  }),
}))

vi.mock('@/features/auth/hooks/use-turnstile', () => ({
  useTurnstile: () => ({
    isTurnstileEnabled: false,
    turnstileSiteKey: '',
    turnstileToken: '',
    setTurnstileToken: vi.fn(),
    validateTurnstile: () => true,
  }),
}))

describe('SignUpForm layout', () => {
  test('uses the auth sizing for email verification controls', () => {
    render(<SignUpForm />)

    expect(
      screen.getByLabelText('Email (required for verification)')
    ).toHaveClass('h-12', 'rounded-lg', 'px-4', 'text-base')
    expect(screen.getByLabelText('Verification code')).toHaveClass(
      'h-12',
      'rounded-lg',
      'px-4',
      'text-base'
    )
    expect(screen.getByRole('button', { name: 'Send code' })).toHaveClass(
      'h-12',
      'rounded-lg',
      'px-4',
      'text-base'
    )
  })

  test('shows the spam-folder reminder as a wrapping warning badge', () => {
    render(<SignUpForm />)

    expect(screen.getByRole('note')).toHaveClass(
      'bg-warning/10',
      'h-auto',
      'max-w-full',
      'whitespace-normal'
    )
  })
})
