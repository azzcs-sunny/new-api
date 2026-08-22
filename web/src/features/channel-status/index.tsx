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
import { useEffect, useRef, useState } from 'react'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { getChannelStatus } from './api'
import { StatusCards } from './components/status-cards'

const refreshIntervalMs = 60 * 1000

export function ChannelStatus() {
  const { t } = useTranslation()
  const [hours, setHours] = useState(24 * 7)
  const [refreshInSeconds, setRefreshInSeconds] = useState(60)
  const statusQuery = useQuery({
    queryKey: ['channel-status', hours],
    queryFn: () => getChannelStatus(hours),
    staleTime: 60 * 1000,
  })
  const isFetchingRef = useRef(statusQuery.isFetching)
  isFetchingRef.current = statusQuery.isFetching
  const result = statusQuery.data?.data
  const items = result?.items ?? []
  const loading = statusQuery.isLoading
  const hasData = loading || items.length > 0
  const dataUpdatedAt = statusQuery.dataUpdatedAt
  const refetch = statusQuery.refetch

  useEffect(() => {
    if (dataUpdatedAt === 0) return

    let active = true
    let refreshPending = false
    let nextRefreshAt = Date.now() + refreshIntervalMs
    setRefreshInSeconds(refreshIntervalMs / 1000)

    const intervalId = window.setInterval(() => {
      const remainingSeconds = Math.max(
        0,
        Math.ceil((nextRefreshAt - Date.now()) / 1000)
      )
      setRefreshInSeconds(remainingSeconds)
      if (remainingSeconds > 0 || refreshPending || isFetchingRef.current) {
        return
      }

      refreshPending = true
      void refetch().finally(() => {
        if (!active) return
        refreshPending = false
        nextRefreshAt = Date.now() + refreshIntervalMs
        setRefreshInSeconds(refreshIntervalMs / 1000)
      })
    }, 1000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [dataUpdatedAt, hours, refetch])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Channel Status')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Tabs
          value={String(hours)}
          onValueChange={(value) => setHours(Number(value))}
        >
          <TabsList>
            <TabsTrigger value='168'>{t('7 days')}</TabsTrigger>
            <TabsTrigger value='360'>{t('15 days')}</TabsTrigger>
            <TabsTrigger value='720'>{t('30 days')}</TabsTrigger>
          </TabsList>
        </Tabs>
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
        <div className='flex flex-col gap-3'>
          {hasData ? (
            <StatusCards
              rows={items}
              loading={loading}
              hours={hours}
              refreshInSeconds={refreshInSeconds}
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
                    : t('Channel Status')}
                </EmptyTitle>
                <EmptyDescription>
                  {statusQuery.isError
                    ? t('Please try again later.')
                    : t('No channel status data is available for this period.')}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
