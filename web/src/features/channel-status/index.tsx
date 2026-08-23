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

import { getChannelStatus } from './api'
import { StatusCards } from './components/status-cards'

const refreshIntervalMs = 60 * 1000

export function ChannelStatus() {
  const { t } = useTranslation()
  const statusQuery = useQuery({
    queryKey: ['channel-status'],
    queryFn: getChannelStatus,
    refetchInterval: refreshIntervalMs,
    staleTime: refreshIntervalMs,
  })
  const items = statusQuery.data?.data.items ?? []
  const hasData = statusQuery.isLoading || items.length > 0

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Channel Status')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
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
          <StatusCards rows={items} loading={statusQuery.isLoading} />
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
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
