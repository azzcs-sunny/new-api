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
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import type { ChannelHealth, ChannelStatusRow } from '../types'

type StatusCardsProps = {
  rows: ChannelStatusRow[]
  loading: boolean
}

const badgeVariant = {
  unknown: 'outline',
  healthy: 'outline',
  warning: 'warning',
  critical: 'destructive',
} as const

const healthBadgeClass = {
  unknown: 'text-muted-foreground',
  healthy: 'border-success/40 bg-success/10 text-success',
  warning: '',
  critical: '',
} as const

const testPlaceholderKeys = Array.from(
  { length: 60 },
  (_, slot) => `empty-${slot}`
)

export function StatusCards(props: StatusCardsProps) {
  const { t } = useTranslation()
  const healthLabel: Record<ChannelHealth, string> = {
    unknown: t('Unknown'),
    healthy: t('Healthy'),
    warning: t('Degraded'),
    critical: t('Error'),
  }

  if (props.loading) {
    return (
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
        {[0, 1, 2].map((item) => (
          <Card key={item} aria-hidden='true'>
            <CardHeader>
              <Skeleton className='h-5 w-32' />
            </CardHeader>
            <CardContent className='grid gap-4'>
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-7 w-full' />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
      {props.rows.map((row) => (
        <StatusCard key={row.group} row={row} healthLabel={healthLabel} />
      ))}
    </div>
  )
}

type StatusCardProps = {
  row: ChannelStatusRow
  healthLabel: Record<ChannelHealth, string>
}

function StatusCard(props: StatusCardProps) {
  const { t } = useTranslation()
  const records = (props.row.records ?? []).slice(-60)
  const health = props.row.health ?? 'unknown'
  const successfulTests = records.filter((record) => record.success).length
  const failedTests = records.length - successfulTests
  const placeholders = Math.max(0, 60 - records.length)
  const latency =
    records.length > 0
      ? `${Math.round(Math.max(0, props.row.latency_ms))} ms`
      : '—'

  return (
    <Card data-testid='channel-status-card' className='h-full overflow-hidden'>
      <CardHeader className='gap-3'>
        <div className='flex items-start justify-between gap-3'>
          <CardTitle className='truncate'>{props.row.group}</CardTitle>
          <Badge
            variant={badgeVariant[health]}
            className={healthBadgeClass[health]}
          >
            {props.healthLabel[health]}
          </Badge>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className='grid gap-5'>
        <dl className='grid grid-cols-2 gap-4'>
          <div className='min-w-0'>
            <dt className='text-muted-foreground text-xs'>{t('Model')}</dt>
            <dd className='mt-1 truncate font-mono text-sm font-semibold'>
              {props.row.model_name}
            </dd>
          </div>
          <div className='min-w-0'>
            <dt className='text-muted-foreground text-xs'>{t('Latency')}</dt>
            <dd className='mt-1 truncate font-mono text-sm font-semibold tabular-nums'>
              {latency}
            </dd>
          </div>
        </dl>

        <Separator />

        <div className='grid gap-2.5'>
          <div className='text-xs font-medium'>{t('Last 60 tests')}</div>
          <div
            className='flex h-7 min-w-0 items-end gap-px'
            aria-label={t('Last 60 tests')}
          >
            <span className='sr-only'>
              {t('{{success}} successful, {{failed}} failed', {
                success: successfulTests,
                failed: failedTests,
              })}
            </span>
            {testPlaceholderKeys.slice(0, placeholders).map((key) => (
              <span
                key={key}
                data-testid='test-record'
                data-status='empty'
                className='bg-muted h-3 min-w-0 flex-1 rounded-[1px]'
                aria-hidden='true'
              />
            ))}
            {records.map((record) => (
              <span
                key={record.id}
                data-testid='test-record'
                data-status={record.success ? 'success' : 'failure'}
                className={cn(
                  'h-7 min-w-0 flex-1 rounded-[1px]',
                  record.success ? 'bg-success' : 'bg-destructive'
                )}
                aria-hidden='true'
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
