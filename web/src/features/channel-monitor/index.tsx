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
import { Refresh01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ChannelStatusDetailDialog } from '@/features/channel-status/components/channel-status-detail-dialog'
import {
  StatusCards,
  type AvailabilityDays,
} from '@/features/channel-status/components/status-cards'
import { filterVisibleChannelStatusRows } from '@/features/channel-status/lib/channel-status-visibility'
import type { ChannelStatusRow } from '@/features/channel-status/types'
import { useCountdown } from '@/hooks/use-countdown'

import { getAllChannelStatus } from './api'

const refreshIntervalMs = 60 * 1000

const statusFilterOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'enabled', label: 'Enabled' },
] as const

const availabilityOptions: AvailabilityDays[] = [7, 15, 30]

type StatusFilter = (typeof statusFilterOptions)[number]['value']

export function ChannelMonitor() {
  const { t } = useTranslation()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [availabilityDays, setAvailabilityDays] = useState<AvailabilityDays>(7)
  const [selectedChannel, setSelectedChannel] = useState<ChannelStatusRow>()
  const { secondsLeft, start } = useCountdown({
    initialSeconds: refreshIntervalMs / 1000,
  })
  const statusQuery = useQuery({
    queryKey: ['channel-monitor-status'],
    queryFn: getAllChannelStatus,
    refetchInterval: refreshIntervalMs,
    refetchIntervalInBackground: true,
    staleTime: 0,
  })
  useEffect(() => {
    start()
  }, [start, statusQuery.dataUpdatedAt])

  const items = filterVisibleChannelStatusRows(
    statusQuery.data?.data.items ?? []
  )
  const selectedStatusLabel =
    statusFilterOptions.find((option) => option.value === statusFilter)
      ?.label ?? 'All Status'
  const filteredItems = items.filter((item) => {
    if (statusFilter === 'all') return true
    const isEnabled = item.channel_status === 1
    return statusFilter === 'enabled' ? isEnabled : !isEnabled
  })
  const hasData = statusQuery.isLoading || filteredItems.length > 0
  let emptyDescription = t('No channel test data is available yet.')
  if (statusQuery.isError) {
    emptyDescription = t('Please try again later.')
  } else if (items.length > 0) {
    emptyDescription = t('No channels match the selected status.')
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Channel Monitoring')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <div className='flex items-center gap-2'>
            <div
              aria-label={t('Availability period')}
              className='bg-muted flex items-center rounded-lg border p-0.5'
            >
              {availabilityOptions.map((days) => (
                <Button
                  key={days}
                  variant={availabilityDays === days ? 'secondary' : 'ghost'}
                  size='sm'
                  className='h-7 px-2 text-xs'
                  aria-pressed={availabilityDays === days}
                  onClick={() => setAvailabilityDays(days)}
                >
                  {t('{{days}} days', { days })}
                </Button>
              ))}
            </div>
            <span className='text-muted-foreground text-xs'>{t('Status')}</span>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                if (
                  value === 'all' ||
                  value === 'disabled' ||
                  value === 'enabled'
                ) {
                  setStatusFilter(value)
                }
              }}
            >
              <SelectTrigger
                className='w-[116px]'
                aria-label={t('Channel monitoring status')}
              >
                <SelectValue>{t(selectedStatusLabel)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {statusFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className='text-muted-foreground text-xs' aria-live='polite'>
            {t('Refreshes in {{seconds}}s', { seconds: secondsLeft })}
          </span>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant='outline'
                  size='icon'
                  aria-label={t('Refresh channel status')}
                  disabled={statusQuery.isFetching}
                  onClick={() => void statusQuery.refetch()}
                />
              }
            >
              <HugeiconsIcon icon={Refresh01Icon} strokeWidth={2} />
            </TooltipTrigger>
            <TooltipContent>{t('Refresh channel status')}</TooltipContent>
          </Tooltip>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          {hasData ? (
            <StatusCards
              rows={filteredItems}
              loading={statusQuery.isLoading}
              availabilityDays={availabilityDays}
              onCardClick={setSelectedChannel}
            />
          ) : (
            <Empty className='min-h-72 border'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <HugeiconsIcon icon={Refresh01Icon} strokeWidth={2} />
                </EmptyMedia>
                <EmptyTitle>
                  {statusQuery.isError
                    ? t('Failed to load')
                    : t('Channel Monitoring')}
                </EmptyTitle>
                <EmptyDescription>{emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </SectionPageLayout.Content>
      </SectionPageLayout>
      {selectedChannel ? (
        <ChannelStatusDetailDialog
          row={selectedChannel}
          onOpenChange={(open) => {
            if (!open) setSelectedChannel(undefined)
          }}
        />
      ) : null}
    </>
  )
}
