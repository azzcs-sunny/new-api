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
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'

type AuthLayoutProps = {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <div className='relative min-h-svh overflow-hidden bg-background'>
      <div
        className='pointer-events-none absolute inset-0 opacity-80'
        aria-hidden='true'
        style={{
          backgroundImage:
            'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, transparent 32%, transparent 68%, rgba(14, 165, 233, 0.08) 100%), linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 32px 32px, 32px 32px',
        }}
      />
      <Link
        to='/'
        className='absolute top-4 left-4 z-20 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border border-border/70 bg-background/75 px-3 py-2 shadow-sm backdrop-blur transition-opacity hover:opacity-80 sm:top-6 sm:left-6 sm:max-w-none'
      >
        <div className='relative h-8 w-8'>
          {loading ? (
            <Skeleton className='absolute inset-0 rounded-full' />
          ) : (
            <img
              src={logo}
              alt={t('Logo')}
              className='h-8 w-8 rounded-full object-cover'
            />
          )}
        </div>
        {loading ? (
          <Skeleton className='h-6 w-24' />
        ) : (
          <h1 className='min-w-0 truncate text-xl font-medium'>{systemName}</h1>
        )}
      </Link>

      <div className='relative mx-auto flex min-h-svh w-full max-w-3xl items-center justify-center px-4 py-20 sm:px-6 lg:px-8 lg:py-10'>
        <div className='w-full max-w-[560px] rounded-3xl border border-border/70 bg-background/80 p-5 shadow-[0_30px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:p-6'>
          {children}
        </div>
      </div>
    </div>
  )
}
