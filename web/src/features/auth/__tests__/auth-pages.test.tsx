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
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AuthLayout } from '../auth-layout'
import { ForgotPassword } from '../forgot-password'
import { SignIn } from '../sign-in'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string
    children?: ReactNode
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useSearch: () => ({}),
}))

vi.mock('@/hooks/use-system-config', () => ({
  useSystemConfig: () => ({
    systemName: 'New API',
    logo: '/logo.png',
    loading: false,
  }),
}))

const statusState = vi.hoisted(() => ({
  current: {
    register_enabled: true,
    password_register_enabled: true,
    self_use_mode_enabled: false,
  },
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: statusState.current }),
}))

afterEach(() => {
  statusState.current = {
    register_enabled: true,
    password_register_enabled: true,
    self_use_mode_enabled: false,
  }
})

vi.mock('@/features/auth/sign-in/components/user-auth-form', () => ({
  UserAuthForm: () => <div data-testid='user-auth-form' />,
}))

vi.mock('@/features/auth/forgot-password/components/forgot-password-form', () => ({
  ForgotPasswordForm: () => <div data-testid='forgot-password-form' />,
}))

describe('auth pages', () => {
  test('auth layout keeps the form centered without the side panel', () => {
    render(
      <AuthLayout>
        <div>Auth form</div>
      </AuthLayout>
    )

    expect(
      screen.queryByText('Configure upstream providers and routing.')
    ).toBeNull()
    expect(screen.getByText('Auth form')).toBeInTheDocument()
  })

  test('sign-in keeps sign-up visible in self-use mode when registration is enabled', () => {
    statusState.current = {
      register_enabled: true,
      password_register_enabled: true,
      self_use_mode_enabled: true,
    }

    render(<SignIn />)

    expect(
      screen.getByRole('link', { name: 'Forgot password?' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Sign up' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('user-auth-form')).toBeInTheDocument()
  })

  test('sign-in hides sign-up when password registration is disabled', () => {
    statusState.current = {
      register_enabled: true,
      password_register_enabled: false,
      self_use_mode_enabled: false,
    }

    render(<SignIn />)

    expect(screen.queryByRole('link', { name: 'Sign up' })).toBeNull()
    expect(
      screen.getByRole('link', { name: 'Forgot password?' })
    ).toBeInTheDocument()
  })

  test('forgot password only offers a return-to-login link', () => {
    render(<ForgotPassword />)

    expect(
      screen.getByRole('link', { name: 'Back to login' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sign up' })).toBeNull()
    expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument()
  })
})
