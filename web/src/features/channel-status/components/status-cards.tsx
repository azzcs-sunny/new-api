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
import type { KeyboardEvent } from 'react'
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
  availabilityDays?: AvailabilityDays
  onCardClick?: (row: ChannelStatusRow) => void
}

export type AvailabilityDays = 7 | 15 | 30

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
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
        {[0, 1, 2, 3].map((item) => (
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
    <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
      {props.rows.map((row) => (
        <StatusCard
          key={`${row.channel_id ?? 'group'}-${row.group}`}
          row={row}
          healthLabel={healthLabel}
          availabilityDays={props.availabilityDays ?? 7}
          onCardClick={props.onCardClick}
        />
      ))}
    </div>
  )
}

type StatusCardProps = {
  row: ChannelStatusRow
  healthLabel: Record<ChannelHealth, string>
  availabilityDays: AvailabilityDays
  onCardClick?: (row: ChannelStatusRow) => void
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

function formatGroupRatio(ratio: number) {
  if (!Number.isFinite(ratio)) return '1'
  return Number.isInteger(ratio)
    ? ratio.toString()
    : ratio.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function StatusCard(props: StatusCardProps) {
  const { t } = useTranslation()
  const records = (props.row.records ?? []).slice(-60)
  const groupRatios = Object.entries(props.row.group_ratios ?? {})
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
  const availability = getAvailability(props.row, props.availabilityDays)
  const isInteractive = props.onCardClick !== undefined

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isInteractive || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    props.onCardClick?.(props.row)
  }

  return (
    <Card
      data-testid='channel-status-card'
      className={cn(
        'h-full overflow-hidden',
        isInteractive &&
          'cursor-pointer transition-colors hover:border-primary/40 focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
      )}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? () => props.onCardClick?.(props.row) : undefined}
      onKeyDown={handleKeyDown}
    >
      <CardHeader className='gap-3'>
        <div className='flex min-w-0 items-start justify-between gap-2'>
          <div className='min-w-0 flex-1'>
            <CardTitle className='truncate'>
              {props.row.channel_name ?? props.row.group}
            </CardTitle>
            {props.row.channel_name && (
              <div className='text-muted-foreground mt-1 flex min-w-0 items-center gap-1 text-xs'>
                <span className='min-w-0 truncate'>
                  #{props.row.channel_id}
                  {props.row.provider ? ` · ${props.row.provider}` : ''}
                  {props.row.group ? ` · ${props.row.group}` : ''}
                </span>
              </div>
            )}
          </div>
          <div
            data-testid='channel-status-card-actions'
            className='flex max-w-[50%] min-w-0 shrink-0 items-center justify-end gap-1 overflow-hidden'
          >
            {groupRatios.length > 0 && (
              <div className='flex min-w-0 flex-1 items-center justify-end gap-1 overflow-hidden'>
                {groupRatios.map(([group, ratio]) => (
                  <Badge
                    key={group}
                    variant='warning'
                    className='h-5 px-1.5 text-[11px]'
                    title={`${t('Group ratio')}: ${group} x${formatGroupRatio(ratio)}`}
                  >
                    x{formatGroupRatio(ratio)}
                  </Badge>
                ))}
              </div>
            )}
            <Badge
              variant={channelDisabled ? 'secondary' : badgeVariant[health]}
              className={channelDisabled ? undefined : healthBadgeClass[health]}
            >
              {channelDisabled ? t('Disabled') : props.healthLabel[health]}
            </Badge>
          </div>
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
                {t('{{days}}-day availability', {
                  days: props.availabilityDays,
                })}
              </dt>
              <dd className='mt-1 truncate font-mono text-sm font-semibold tabular-nums'>
                {availability.samples > 0
                  ? `${availability.value.toFixed(1)}%`
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
                className='bg-muted min-w-0 flex-1 rounded-[2px]'
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

function getAvailability(row: ChannelStatusRow, days: AvailabilityDays) {
  switch (days) {
    case 15:
      return {
        value: row.availability_15d ?? 0,
        samples: row.availability_15d_samples ?? 0,
      }
    case 30:
      return {
        value: row.availability_30d ?? 0,
        samples: row.availability_30d_samples ?? 0,
      }
    case 7:
    default:
      return {
        value: row.availability_7d ?? 0,
        samples: row.availability_7d_samples ?? 0,
      }
  }
}

function TestRecordBar({ record }: { record: ChannelTestRecord }) {
  const display = recordDisplay(record)

  return (
    <span
      data-testid='test-record'
      data-status={display.status}
      title={`${Math.round(Math.max(0, record.latency_ms))} ms`}
      style={{ height: `${display.heightPercent}%` }}
      className={cn('min-w-0 flex-1 rounded-[2px]', display.colorClass)}
      aria-hidden='true'
    />
  )
}
