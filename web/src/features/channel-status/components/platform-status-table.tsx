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
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getChannelTypeIcon } from '@/features/channels/lib/channel-utils'
import { formatTimestampToDate } from '@/lib/format'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import type {
  ChannelHealth,
  ChannelStatusRow,
  ChannelTestRecord,
} from '../types'
import type { AvailabilityDays } from './status-cards'

type PlatformStatusTableProps = {
  rows: ChannelStatusRow[]
  loading: boolean
  availabilityDays?: AvailabilityDays
  onRowClick?: (row: ChannelStatusRow) => void
  onModelClick?: (modelName: string) => void
}

type PlatformGroup = {
  key: string
  label: string
  rows: ChannelStatusRow[]
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
const channelColumnClass =
  'lg:grid-cols-[minmax(180px,260px)_110px_96px_104px_104px_minmax(260px,1fr)]'

export function PlatformStatusTable(props: PlatformStatusTableProps) {
  const { t } = useTranslation()
  const groups = groupRowsByPlatform(props.rows)

  if (props.loading) {
    return (
      <div className='grid h-full min-h-0 gap-5 overflow-y-auto pr-1'>
        {[0, 1, 2].map((item) => (
          <Card
            key={item}
            data-card-hover='false'
            className='overflow-hidden'
            aria-hidden='true'
          >
            <div className='border-b px-4 py-3'>
              <Skeleton className='h-5 w-28' />
            </div>
            <div className='grid gap-3 p-4'>
              <Skeleton className='h-12 w-full' />
              <Skeleton className='h-12 w-full' />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <TooltipProvider delay={0}>
      <div className='h-full min-h-0 overflow-y-auto pr-1'>
        <div className='grid gap-5'>
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`platform-${group.key}`}>
              <div className='mb-2 flex items-center gap-2'>
                <PlatformGroupIcon row={group.rows[0]} />
                <h2
                  id={`platform-${group.key}`}
                  className='text-sm font-semibold'
                >
                  {t(group.label)}
                </h2>
                <Badge variant='secondary' className='h-5 px-1.5 text-[11px]'>
                  {group.rows.length}
                </Badge>
              </div>
              <Card data-card-hover='false' className='overflow-hidden'>
                <div
                  className={cn(
                    'bg-muted/40 text-muted-foreground hidden border-b px-4 py-2 text-xs font-medium lg:grid lg:gap-5',
                    channelColumnClass
                  )}
                >
                  <span>
                    {t('Channel')} / {t('Model')}
                  </span>
                  <span>{t('Status')}</span>
                  <span>{t('Group ratio')}</span>
                  <span>{t('Latency')}</span>
                  <span>{t('Success rate')}</span>
                  <span>{t('Last 60 tests')}</span>
                </div>
                <div className='divide-y'>
                  {group.rows.map((row) => (
                    <PlatformStatusRow
                      key={`${row.channel_id ?? row.group}-${row.model_name}`}
                      row={row}
                      availabilityDays={props.availabilityDays ?? 7}
                      onRowClick={props.onRowClick}
                      onModelClick={props.onModelClick}
                    />
                  ))}
                </div>
              </Card>
            </section>
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}

function groupRowsByPlatform(rows: ChannelStatusRow[]): PlatformGroup[] {
  const groups = new Map<string, ChannelStatusRow[]>()
  for (const row of rows) {
    const label = getStatusPlatform(row)
    groups.set(label, [...(groups.get(label) ?? []), row])
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, groupRows]) => ({
      key: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      label,
      rows: [...groupRows].sort(compareStatusRows),
    }))
}

export function getStatusPlatform(row: ChannelStatusRow): string {
  return row.provider?.trim() || 'Unknown'
}

function compareStatusRows(left: ChannelStatusRow, right: ChannelStatusRow) {
  const leftName = left.channel_name || left.model_name
  const rightName = right.channel_name || right.model_name
  return leftName.localeCompare(rightName)
}

function PlatformStatusRow(props: {
  row: ChannelStatusRow
  availabilityDays: AvailabilityDays
  onRowClick?: (row: ChannelStatusRow) => void
  onModelClick?: (modelName: string) => void
}) {
  const { t } = useTranslation()
  const records = (props.row.records ?? []).slice(-60)
  const placeholderCount = Math.max(0, 60 - records.length)
  const health = props.row.health ?? 'unknown'
  const channelDisabled =
    props.row.channel_status !== undefined && props.row.channel_status !== 1
  const healthLabel: Record<ChannelHealth, string> = {
    unknown: t('Unknown'),
    healthy: t('Healthy'),
    warning: t('Degraded'),
    critical: t('Error'),
  }
  const successfulTests = records.filter((record) => record.success).length
  const failedTests = records.length - successfulTests
  const isInteractive = props.onRowClick !== undefined
  const availability = getAvailability(props.row, props.availabilityDays)
  const channelName = props.row.channel_name || props.row.model_name
  const modelName = props.row.model_name

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isInteractive || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    props.onRowClick?.(props.row)
  }

  return (
    <div
      data-testid='channel-status-card'
      className={cn(
        'grid gap-3 px-4 py-3 lg:items-center lg:gap-5',
        channelColumnClass,
        isInteractive &&
          'cursor-pointer transition-colors hover:bg-muted/40 focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
      )}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? () => props.onRowClick?.(props.row) : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className='flex min-w-0 items-center gap-3'>
        <ChannelTypeLogo row={props.row} size={18} className='size-8' />
        <Tooltip>
          <TooltipTrigger render={<div className='min-w-0 flex-1' />}>
            {props.row.channel_name ? (
              <div className='truncate text-sm font-semibold'>
                {channelName}
              </div>
            ) : (
              <ModelLink
                modelName={modelName}
                className='text-sm font-semibold'
                onModelClick={props.onModelClick}
              />
            )}
            {props.row.channel_name ? (
              <ModelLink
                modelName={modelName}
                className='font-mono text-xs'
                onModelClick={props.onModelClick}
              />
            ) : null}
          </TooltipTrigger>
          <TooltipContent className='max-w-sm flex-col items-start break-all'>
            <span>{channelName}</span>
            {props.row.channel_name ? (
              <span className='font-mono'>{modelName}</span>
            ) : null}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className='flex items-center gap-2 lg:block'>
        <span className='text-muted-foreground w-24 text-xs lg:hidden'>
          {t('Status')}
        </span>
        <Badge
          variant={channelDisabled ? 'secondary' : badgeVariant[health]}
          className={channelDisabled ? undefined : healthBadgeClass[health]}
        >
          {channelDisabled ? t('Disabled') : healthLabel[health]}
        </Badge>
      </div>
      <RatioCell
        label={t('Group ratio')}
        ratios={Object.values(props.row.group_ratios ?? {})}
      />
      <MetricCell label={t('Latency')} value={formatLatency(props.row)} />
      <MetricCell
        label={t('Success rate')}
        value={formatSuccessRate(props.row)}
      />
      <div className='min-w-0'>
        <div className='mb-2 flex items-center justify-between gap-2 lg:hidden'>
          <span className='text-muted-foreground text-xs'>
            {t('Last 60 tests')}
          </span>
          <span className='text-muted-foreground text-xs'>
            {formatAvailability(availability)}
          </span>
        </div>
        <div
          className='isolate flex h-2.5 min-w-0 items-stretch gap-[2px]'
          aria-label={t('Last 60 tests')}
        >
          <span className='sr-only'>
            {t('{{success}} successful, {{failed}} failed', {
              success: successfulTests,
              failed: failedTests,
            })}
          </span>
          {testPlaceholderKeys
            .slice(0, placeholderCount)
            .map((placeholder, index, placeholders) => (
              <span
                key={placeholder}
                data-testid='test-record'
                data-status='empty'
                className={cn(
                  'bg-muted min-w-0 flex-1',
                  getRecordEdgeClass(
                    index,
                    placeholders.length + records.length
                  )
                )}
                aria-hidden='true'
              />
            ))}
          {records.map((record, index) => (
            <TestRecordBar
              key={record.id}
              record={record}
              index={placeholderCount + index}
              total={60}
            />
          ))}
        </div>
        <div className='text-muted-foreground mt-1.5 truncate text-xs'>
          {t('Updated')}:{' '}
          {formatTimestampToDate(props.row.latest_checked_at, 'milliseconds')}
        </div>
      </div>
    </div>
  )
}

function PlatformGroupIcon(props: { row?: ChannelStatusRow }) {
  if (!props.row) return null

  return (
    <ChannelTypeLogo row={props.row} size={14} className='size-6 rounded-md' />
  )
}

function ChannelTypeLogo(props: {
  row: ChannelStatusRow
  size: number
  className?: string
}) {
  const iconName =
    typeof props.row.channel_type === 'number'
      ? getChannelTypeIcon(props.row.channel_type)
      : undefined
  const icon = iconName ? getLobeIcon(`${iconName}.Color`, props.size) : null

  return (
    <div
      className={cn(
        'bg-muted flex shrink-0 items-center justify-center rounded-md text-xs font-semibold',
        props.className
      )}
      aria-hidden='true'
    >
      {icon ??
        (props.row.provider || props.row.model_name || '?')
          .slice(0, 1)
          .toUpperCase()}
    </div>
  )
}

function ModelLink(props: {
  modelName: string
  className?: string
  onModelClick?: (modelName: string) => void
}) {
  if (!props.onModelClick) {
    return (
      <span className={cn('text-primary truncate', props.className)}>
        {props.modelName}
      </span>
    )
  }

  return (
    <button
      type='button'
      className={cn(
        'text-primary hover:text-primary/80 focus-visible:ring-ring block max-w-full truncate text-left underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none',
        props.className
      )}
      onClick={(event) => {
        event.stopPropagation()
        props.onModelClick?.(props.modelName)
      }}
    >
      {props.modelName}
    </button>
  )
}

function MetricCell(props: { label: string; value: string }) {
  return (
    <div className='flex items-center gap-2 lg:block'>
      <span className='text-muted-foreground w-24 text-xs lg:hidden'>
        {props.label}
      </span>
      <span className='truncate font-mono text-sm font-semibold tabular-nums'>
        {props.value}
      </span>
    </div>
  )
}

function RatioCell(props: { label: string; ratios: number[] }) {
  return (
    <div className='flex items-center gap-2 lg:block'>
      <span className='text-muted-foreground w-24 text-xs lg:hidden'>
        {props.label}
      </span>
      <div className='flex min-w-0 flex-wrap items-center gap-1'>
        {props.ratios.length > 0 ? (
          props.ratios.map((ratio, index) => (
            <Badge
              key={`${ratio}-${index}`}
              variant='warning'
              className='h-5 px-1.5 font-mono text-[11px]'
            >
              x{formatGroupRatio(ratio)}
            </Badge>
          ))
        ) : (
          <span className='truncate font-mono text-sm font-semibold tabular-nums'>
            —
          </span>
        )}
      </div>
    </div>
  )
}

function TestRecordBar({
  record,
  index,
  total,
}: {
  record: ChannelTestRecord
  index: number
  total: number
}) {
  const { t } = useTranslation()
  const display = recordDisplay(record)
  const latency = formatLatencyMs(record.latency_ms)
  const testedAt = formatTimestampToDate(record.tested_at, 'milliseconds')
  const statusLabel = getRecordStatusLabel(record, t)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            data-testid='test-record'
            data-status={display.status}
            className={cn(
              'min-w-0 flex-1 transition-[transform,box-shadow,opacity] hover:z-10 hover:scale-y-[1.7] hover:shadow-sm hover:ring-2 hover:ring-foreground/35',
              display.colorClass,
              getRecordEdgeClass(index, total)
            )}
            aria-label={latency}
          />
        }
      />
      <TooltipContent className='min-w-40 flex-col items-stretch gap-1.5'>
        <div className='flex items-center justify-between gap-4'>
          <span className='text-background/70'>{t('Latency')}</span>
          <span className='font-mono font-semibold tabular-nums'>
            {latency}
          </span>
        </div>
        <div className='flex items-center justify-between gap-4'>
          <span className='text-background/70'>{t('Status')}</span>
          <span>{statusLabel}</span>
        </div>
        <div className='border-background/15 text-background/80 border-t pt-1.5 font-mono tabular-nums'>
          {testedAt}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function getRecordStatusLabel(
  record: ChannelTestRecord,
  t: ReturnType<typeof useTranslation>['t']
) {
  if (!record.success) return t('Error')
  if (record.latency_ms >= degradedLatencyMs) return t('Degraded')
  return t('Healthy')
}

function recordDisplay(record: ChannelTestRecord) {
  if (!record.success) {
    return {
      colorClass: 'bg-destructive',
      status: 'failure',
    }
  }
  if (record.latency_ms >= degradedLatencyMs) {
    return {
      colorClass: 'bg-warning',
      status: 'degraded',
    }
  }
  return { colorClass: 'bg-success', status: 'success' }
}

function getRecordEdgeClass(index: number, total: number) {
  if (total <= 1) return 'rounded-full'
  if (index === 0) return 'rounded-l-full'
  if (index === total - 1) return 'rounded-r-full'
  return ''
}

function formatGroupRatio(ratio: number) {
  if (!Number.isFinite(ratio)) return '1'
  return Number.isInteger(ratio)
    ? ratio.toString()
    : ratio.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function formatLatency(row: ChannelStatusRow) {
  if (!row.records?.length) return '—'
  return formatLatencyMs(row.latency_ms)
}

function formatLatencyMs(latencyMs: number) {
  if (!Number.isFinite(latencyMs)) return '—'
  return `${Math.round(Math.max(0, latencyMs))} ms`
}

function formatSuccessRate(row: ChannelStatusRow) {
  if (row.recent_success_rate === undefined) return '—'
  return `${row.recent_success_rate.toFixed(1)}%`
}

function formatAvailability(availability: {
  value?: number
  samples?: number
}) {
  if (!availability.samples) return '—'
  return `${(availability.value ?? 0).toFixed(1)}%`
}

function getAvailability(row: ChannelStatusRow, days: AvailabilityDays) {
  if (days === 15) {
    return {
      value: row.availability_15d,
      samples: row.availability_15d_samples,
    }
  }
  if (days === 30) {
    return {
      value: row.availability_30d,
      samples: row.availability_30d_samples,
    }
  }
  return {
    value: row.availability_7d,
    samples: row.availability_7d_samples,
  }
}
