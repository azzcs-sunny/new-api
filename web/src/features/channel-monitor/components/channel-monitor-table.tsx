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
import { Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { StaticDataTable } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ChannelStatusRow } from '@/features/channel-status/types'
import { ChannelTypeLogo } from '@/features/channels/components/channel-type-badge'
import {
  getChannelStatusBadge,
  getChannelTypeLabel,
} from '@/features/channels/lib/channel-utils'
import { formatTimestampToDate } from '@/lib/format'

type ChannelMonitorTableProps = {
  rows: ChannelStatusRow[]
  pendingActiveTestChannelId?: number
  pendingClearChannelId?: number
  pendingChannelId?: number
  onActiveTestChange: (channelId: number, enabled: boolean) => void
  onClearTestData: (channelId: number) => Promise<void>
  onVisibilityChange: (channelId: number, visible: boolean) => void
}

export function ChannelMonitorTable(props: ChannelMonitorTableProps) {
  const { t } = useTranslation()
  const [clearTarget, setClearTarget] = useState<ChannelStatusRow | null>(null)
  const {
    onActiveTestChange,
    onClearTestData,
    onVisibilityChange,
    pendingActiveTestChannelId,
    pendingClearChannelId,
    pendingChannelId,
    rows,
  } = props
  const columns = useMemo(
    () => [
      {
        id: 'name',
        header: t('Name'),
        cell: (row: ChannelStatusRow) => (
          <div className='flex min-w-0 items-center gap-2'>
            <span className='text-muted-foreground font-mono text-xs'>
              #{row.channel_id}
            </span>
            <span className='truncate font-medium'>
              {row.channel_name || row.model_name}
            </span>
          </div>
        ),
      },
      {
        id: 'type',
        header: t('Type'),
        cell: (row: ChannelStatusRow) => {
          const channelType = row.channel_type ?? 0
          return (
            <div className='flex min-w-0 items-center gap-2'>
              <ChannelTypeLogo type={channelType} size={18} />
              <span>{t(getChannelTypeLabel(channelType))}</span>
            </div>
          )
        },
      },
      {
        id: 'status',
        header: t('Status'),
        cell: (row: ChannelStatusRow) => {
          const status = getChannelStatusBadge(row.channel_status ?? 0)
          return (
            <StatusBadge
              label={t(status.label)}
              variant={status.variant}
              copyable={false}
            />
          )
        },
      },
      {
        id: 'group',
        header: t('Group'),
        cell: (row: ChannelStatusRow) => (
          <div className='flex min-w-0 flex-wrap gap-1'>
            {(row.group || '')
              .split(',')
              .map((group) => group.trim())
              .filter(Boolean)
              .map((group) => (
                <GroupBadge key={group} group={group} />
              ))}
          </div>
        ),
      },
      {
        id: 'last-tested',
        header: t('Last Tested'),
        cell: (row: ChannelStatusRow) => (
          <span className='font-mono text-xs tabular-nums'>
            {formatTimestampToDate(row.latest_checked_at, 'milliseconds')}
          </span>
        ),
      },
      {
        id: 'active-test',
        header: t('Active checks'),
        className: 'w-36 text-right',
        cellClassName: 'text-right',
        cell: (row: ChannelStatusRow) => (
          <Switch
            aria-label={t('Include {{name}} in active checks', {
              name: row.channel_name || row.model_name,
            })}
            checked={row.active_test_enabled ?? true}
            disabled={pendingActiveTestChannelId === row.channel_id}
            onCheckedChange={(checked) => {
              if (row.channel_id !== undefined) {
                onActiveTestChange(row.channel_id, checked)
              }
            }}
          />
        ),
      },
      {
        id: 'visible',
        header: t('Show on channel status'),
        className: 'w-44 text-right',
        cellClassName: 'text-right',
        cell: (row: ChannelStatusRow) => (
          <Switch
            aria-label={t('Show {{name}} on channel status', {
              name: row.channel_name || row.model_name,
            })}
            checked={row.visible ?? true}
            disabled={pendingChannelId === row.channel_id}
            onCheckedChange={(checked) => {
              if (row.channel_id !== undefined) {
                onVisibilityChange(row.channel_id, checked)
              }
            }}
          />
        ),
      },
      {
        id: 'actions',
        header: t('Actions'),
        className: 'w-20 text-right',
        cellClassName: 'text-right',
        cell: (row: ChannelStatusRow) => {
          const channelName = row.channel_name || row.model_name
          return (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon'
                    className='text-muted-foreground hover:text-destructive'
                    aria-label={t('Clear test data for {{name}}', {
                      name: channelName,
                    })}
                    disabled={
                      row.channel_id === undefined ||
                      pendingClearChannelId === row.channel_id ||
                      row.records.length === 0
                    }
                    onClick={() => setClearTarget(row)}
                  />
                }
              >
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
              </TooltipTrigger>
              <TooltipContent>{t('Clear test data')}</TooltipContent>
            </Tooltip>
          )
        },
      },
    ],
    [
      onActiveTestChange,
      onVisibilityChange,
      pendingActiveTestChannelId,
      pendingClearChannelId,
      pendingChannelId,
      t,
    ]
  )

  return (
    <>
      <StaticDataTable
        data={rows}
        columns={columns}
        getRowKey={(row) => row.channel_id ?? `${row.group}-${row.model_name}`}
        emptyContent={t('No channels found.')}
        tableClassName='min-w-[1080px]'
      />
      <ConfirmDialog
        open={clearTarget !== null}
        onOpenChange={(open) => {
          if (!open && pendingClearChannelId === undefined) {
            setClearTarget(null)
          }
        }}
        title={t('Clear test data?')}
        desc={t(
          'This clears all active-check history for {{name}}, including the latest 60 tests and availability statistics. Manual test history is retained.',
          { name: clearTarget?.channel_name || clearTarget?.model_name || '' }
        )}
        confirmText={t('Clear')}
        destructive
        isLoading={pendingClearChannelId !== undefined}
        handleConfirm={() => {
          if (clearTarget?.channel_id === undefined) return
          void onClearTestData(clearTarget.channel_id).then(
            () => {
              setClearTarget(null)
            },
            () => undefined
          )
        }}
      />
    </>
  )
}
