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

import type {
  ChannelHealth,
  ChannelStatusRow,
  ChannelTestRecord,
} from '../types'

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

const degradedLatencyMs = 6000

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
        <StatusCard
          key={row.channel_id ?? row.group}
          row={row}
          healthLabel={healthLabel}
        />
      ))}
    </div>
  )
}

type StatusCardProps = {
  row: ChannelStatusRow
  healthLabel: Record<ChannelHealth, string>
}

function recordDisplay(record: ChannelTestRecord) {
  if (!record.success) {
    return {
      colorClass: 'bg-destructive',
      heightPercent: 35,
      status: 'failure',
    }
  }
  if (record.latency_ms >= degradedLatencyMs) {
    return {
      colorClass: 'bg-warning',
      heightPercent: 65,
      status: 'degraded',
    }
  }
  return { colorClass: 'bg-success', heightPercent: 100, status: 'success' }
}

function StatusCard(props: StatusCardProps) {
  const { t } = useTranslation()
  const records = (props.row.records ?? []).slice(-60)
  const health = props.row.health ?? 'unknown'
  const channelDisabled =
    props.row.channel_status !== undefined && props.row.channel_status !== 1
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
          <div className='min-w-0'>
            <CardTitle className='truncate'>
              {props.row.channel_name ?? props.row.group}
            </CardTitle>
            {props.row.channel_name && (
              <div className='text-muted-foreground mt-1 truncate text-xs'>
                #{props.row.channel_id}
                {props.row.provider ? ` · ${props.row.provider}` : ''}
                {props.row.group ? ` · ${props.row.group}` : ''}
              </div>
            )}
          </div>
          <Badge
            variant={channelDisabled ? 'secondary' : badgeVariant[health]}
            className={channelDisabled ? undefined : healthBadgeClass[health]}
          >
            {channelDisabled ? t('Disabled') : props.healthLabel[health]}
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
          {props.row.channel_id !== undefined && (
            <div className='min-w-0'>
              <dt className='text-muted-foreground text-xs'>
                {t('Success rate')}
              </dt>
              <dd className='mt-1 truncate font-mono text-sm font-semibold tabular-nums'>
                {records.length > 0
                  ? `${(props.row.recent_success_rate ?? 0).toFixed(1)}%`
                  : '—'}
              </dd>
            </div>
          )}
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
                style={{ height: '15%' }}
                className='bg-muted min-w-0 flex-1 rounded-[1px]'
                aria-hidden='true'
              />
            ))}
            {records.map((record) => (
              <TestRecordBar key={record.id} record={record} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TestRecordBar({ record }: { record: ChannelTestRecord }) {
  const display = recordDisplay(record)

  return (
    <span
      data-testid='test-record'
      data-status={display.status}
      title={`${Math.round(Math.max(0, record.latency_ms))} ms`}
      style={{ height: `${display.heightPercent}%` }}
      className={cn('min-w-0 flex-1 rounded-[1px]', display.colorClass)}
      aria-hidden='true'
    />
  )
}
