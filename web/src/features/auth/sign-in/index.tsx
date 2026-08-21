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
import { Link, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

import { AuthLayout } from '../auth-layout'
import { TermsFooter } from '../components/terms-footer'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { t } = useTranslation()
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const { status } = useStatus()
  const registrationEnabled =
    (status?.register_enabled ?? status?.data?.register_enabled ?? true) !==
    false
  const passwordRegistrationEnabled =
    (status?.password_register_enabled ??
      status?.data?.password_register_enabled ??
      true) !== false
  const canSignUp = registrationEnabled && passwordRegistrationEnabled

  return (
    <AuthLayout>
      <div className='w-full space-y-6'>
        <div className='space-y-2'>
          <h2 className='text-center text-2xl font-semibold tracking-tight sm:text-left'>
            {t('Sign in')}
          </h2>
        </div>

        <UserAuthForm redirectTo={redirect} />

        <div
          className={cn(
            'grid gap-2',
            canSignUp ? 'sm:grid-cols-2' : 'sm:grid-cols-1'
          )}
        >
          <Link
            to='/forgot-password'
            className='inline-flex h-12 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground'
          >
            {t('Forgot password?')}
          </Link>

          {canSignUp && (
            <Link
              to='/sign-up'
              className='inline-flex h-12 items-center justify-center rounded-lg border border-primary/30 bg-primary/5 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/10'
            >
              {t('Sign up')}
            </Link>
          )}
        </div>

        <TermsFooter
          variant='sign-in'
          status={status}
          className='text-center'
        />
      </div>
    </AuthLayout>
  )
}
