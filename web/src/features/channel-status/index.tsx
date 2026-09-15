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
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DEFAULT_TOKEN_UNIT } from '@/features/pricing/constants'
import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import { useCountdown } from '@/hooks/use-countdown'

import { getChannelStatus } from './api'
import { ChannelStatusDetailDialog } from './components/channel-status-detail-dialog'
import { PlatformStatusTable } from './components/platform-status-table'
import type { AvailabilityDays } from './components/status-cards'
import { filterVisibleChannelStatusRows } from './lib/channel-status-visibility'
import type { ChannelStatusRow } from './types'

const refreshIntervalMs = 60 * 1000
const availabilityOptions: AvailabilityDays[] = [7, 15, 30]
const enableChannelDetailClick = false
const ModelDetailsDrawer = lazy(() =>
  import('@/features/pricing/components/model-details').then((module) => ({
    default: module.ModelDetailsDrawer,
  }))
)

export function ChannelStatus() {
  const { t } = useTranslation()
  const [availabilityDays, setAvailabilityDays] = useState<AvailabilityDays>(7)
  const [selectedChannel, setSelectedChannel] = useState<ChannelStatusRow>()
  const [selectedModelName, setSelectedModelName] = useState<string>()
  const { secondsLeft, start } = useCountdown({
    initialSeconds: refreshIntervalMs / 1000,
  })
  const statusQuery = useQuery({
    queryKey: ['channel-status'],
    queryFn: getChannelStatus,
    refetchInterval: refreshIntervalMs,
    refetchIntervalInBackground: true,
    staleTime: 0,
  })
  useEffect(() => {
    start()
  }, [start, statusQuery.dataUpdatedAt])

  const items = useMemo(
    () => filterVisibleChannelStatusRows(statusQuery.data?.data.items ?? []),
    [statusQuery.data?.data.items]
  )
  const hasData = statusQuery.isLoading || items.length > 0

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Channel Status')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <div
            aria-hidden='true'
            aria-label={t('Availability period')}
            className='bg-muted hidden items-center rounded-lg border p-0.5'
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
          <div className='h-full min-h-0 overflow-hidden'>
            {hasData ? (
              <PlatformStatusTable
                rows={items}
                notices={statusQuery.data?.data.notices ?? []}
                loading={statusQuery.isLoading}
                availabilityDays={availabilityDays}
                onRowClick={
                  enableChannelDetailClick ? setSelectedChannel : undefined
                }
                onModelClick={setSelectedModelName}
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
                      : t('No channel test data is available yet.')}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
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
      {selectedModelName ? (
        <ChannelStatusModelDetails
          modelName={selectedModelName}
          onOpenChange={(open) => {
            if (!open) setSelectedModelName(undefined)
          }}
        />
      ) : null}
    </>
  )
}

function ChannelStatusModelDetails(props: {
  modelName: string
  onOpenChange: (open: boolean) => void
}) {
  const {
    models,
    groupRatio,
    usableGroup,
    endpointMap,
    autoGroups,
    priceRate,
    usdExchangeRate,
  } = usePricingData()

  const model = useMemo(
    () =>
      models.find((item) => item.model_name === props.modelName) ??
      models.find(
        (item) =>
          item.model_name.toLowerCase() === props.modelName.toLowerCase()
      ),
    [models, props.modelName]
  )

  if (!model) return null

  return (
    <Suspense fallback={null}>
      <ModelDetailsDrawer
        open
        onOpenChange={props.onOpenChange}
        model={model}
        groupRatio={groupRatio}
        usableGroup={usableGroup}
        endpointMap={
          endpointMap as Record<string, { path?: string; method?: string }>
        }
        autoGroups={autoGroups}
        priceRate={priceRate}
        usdExchangeRate={usdExchangeRate}
        tokenUnit={DEFAULT_TOKEN_UNIT}
        showApiTab={false}
      />
    </Suspense>
  )
}
