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

import { ForgotPasswordForm } from '../forgot-password-form'

vi.mock('@/features/auth/hooks/use-turnstile', () => ({
  useTurnstile: () => ({
    isTurnstileEnabled: false,
    turnstileSiteKey: '',
    turnstileToken: '',
    setTurnstileToken: vi.fn(),
    validateTurnstile: () => true,
  }),
}))

describe('ForgotPasswordForm layout', () => {
  test('uses the auth input and primary button sizing from sign-in', () => {
    render(<ForgotPasswordForm />)

    expect(screen.getByLabelText('Email')).toHaveClass(
      'h-12',
      'rounded-lg',
      'px-4',
      'text-base'
    )
    expect(
      screen.getByRole('button', { name: /send reset email/i })
    ).toHaveClass('h-12', 'rounded-lg', 'px-4', 'text-base')
  })
})
