/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License
as published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { ChatDelayIcon, Globe02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import {
  buildUsageRecords,
  formatMilliseconds,
  formatPercent,
} from '../lib/format'
import type { ChannelHealth, ChannelStatusRow } from '../types'

type StatusCardsProps = {
  rows: ChannelStatusRow[]
  loading: boolean
  hours: number
  refreshInSeconds: number
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

const usagePlaceholderKeys = Array.from(
  { length: 60 },
  (_, slot) => `empty-${slot}`
)

export function StatusCards(props: StatusCardsProps) {
  const { t } = useTranslation()
  const healthLabel: Record<ChannelHealth, string> = {
    unknown: t('Unknown'),
    healthy: t('Operational'),
    warning: t('Degraded'),
    critical: t('Unavailable'),
  }

  if (props.loading) {
    return (
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
        {[0, 1, 2].map((item) => (
          <Card key={item} aria-hidden='true'>
            <CardHeader>
              <Skeleton className='h-5 w-32' />
              <Skeleton className='h-4 w-44' />
            </CardHeader>
            <CardContent className='grid gap-4'>
              <Skeleton className='h-12 w-full' />
              <Skeleton className='h-5 w-full' />
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
          key={row.group}
          row={row}
          healthLabel={healthLabel}
          hours={props.hours}
          refreshInSeconds={props.refreshInSeconds}
        />
      ))}
    </div>
  )
}

type StatusCardProps = {
  row: ChannelStatusRow
  healthLabel: Record<ChannelHealth, string>
  hours: number
  refreshInSeconds: number
}

function StatusCard(props: StatusCardProps) {
  const { t } = useTranslation()
  const usageRecords = useMemo(
    () => buildUsageRecords(props.row.series),
    [props.row.series]
  )
  const successfulUses = usageRecords.filter(
    (record) => record.status === 'success'
  ).length
  const failedUses = usageRecords.length - successfulUses
  const placeholders = Math.max(0, 60 - usageRecords.length)

  return (
    <Card data-testid='channel-status-card' className='h-full overflow-hidden'>
      <CardHeader className='gap-3'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <CardTitle className='truncate'>{props.row.group}</CardTitle>
            <div className='mt-2 flex min-w-0 items-center gap-2'>
              <Badge variant='secondary'>{props.row.provider}</Badge>
              <span className='text-muted-foreground truncate font-mono text-xs'>
                {props.row.model_name}
              </span>
            </div>
          </div>
          <Badge
            variant={badgeVariant[props.row.metrics.health]}
            className={healthBadgeClass[props.row.metrics.health]}
          >
            {props.healthLabel[props.row.metrics.health]}
          </Badge>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className='grid gap-5'>
        <div className='grid grid-cols-2 gap-4'>
          <div className='flex min-w-0 items-start gap-3'>
            <HugeiconsIcon
              icon={ChatDelayIcon}
              className='text-muted-foreground mt-0.5 size-5 shrink-0'
              strokeWidth={1.8}
              aria-hidden='true'
            />
            <div className='min-w-0'>
              <div className='text-muted-foreground truncate text-xs'>
                {t('Conversation latency')}
              </div>
              <div className='mt-1 truncate font-mono text-lg font-semibold tabular-nums'>
                {formatMilliseconds(props.row.metrics.latest_latency_ms)}
              </div>
            </div>
          </div>
          <div className='flex min-w-0 items-start gap-3'>
            <HugeiconsIcon
              icon={Globe02Icon}
              className='text-muted-foreground mt-0.5 size-5 shrink-0'
              strokeWidth={1.8}
              aria-hidden='true'
            />
            <div className='min-w-0'>
              <div className='text-muted-foreground truncate text-xs'>
                {t('Node PING')}
              </div>
              <div className='mt-1 truncate font-mono text-lg font-semibold tabular-nums'>
                {formatMilliseconds(props.row.ping_ms)}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className='flex items-center justify-between gap-3'>
          <div className='text-muted-foreground text-sm'>
            {t('Availability')}
            <span aria-hidden='true'> · </span>
            {props.hours / 24} {t('days')}
          </div>
          <div className='font-mono text-sm font-semibold tabular-nums'>
            {props.row.metrics.has_data
              ? formatPercent(props.row.metrics.success_rate)
              : '—'}
          </div>
        </div>

        <Separator />

        <div className='grid gap-2.5'>
          <div className='flex items-center justify-between gap-3 text-xs'>
            <span className='font-medium'>{t('Last 60 uses')}</span>
            <span className='text-muted-foreground tabular-nums'>
              {t('Refreshes in {{seconds}}s', {
                seconds: props.refreshInSeconds,
              })}
            </span>
          </div>
          <div
            className='flex h-7 min-w-0 items-end gap-px'
            aria-label={t('Last 60 uses')}
          >
            <span className='sr-only'>
              {t('{{success}} successful, {{failed}} failed', {
                success: successfulUses,
                failed: failedUses,
              })}
            </span>
            {usagePlaceholderKeys.slice(0, placeholders).map((key) => (
              <span
                key={key}
                data-testid='usage-record'
                data-status='empty'
                className='bg-muted h-3 min-w-0 flex-1 rounded-[1px]'
                aria-hidden='true'
              />
            ))}
            {usageRecords.map((record) => (
              <span
                key={record.id}
                data-testid='usage-record'
                data-status={record.status}
                className={cn(
                  'h-7 min-w-0 flex-1 rounded-[1px]',
                  record.status === 'success' ? 'bg-success' : 'bg-destructive'
                )}
                aria-hidden='true'
              />
            ))}
          </div>
          <div className='text-muted-foreground flex justify-between text-[10px] font-medium uppercase'>
            <span>{t('Past')}</span>
            <span>{t('Now')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
