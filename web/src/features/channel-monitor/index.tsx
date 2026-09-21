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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ChannelStatusResponse } from '@/features/channel-status/types'
import { useCountdown } from '@/hooks/use-countdown'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

import {
  clearChannelTestData,
  getAllChannelStatus,
  updateChannelActiveTestEnabled,
  updateChannelStatusHealthyThreshold,
  updateChannelStatusVisibility,
} from './api'
import { ChannelMonitorTable } from './components/channel-monitor-table'

const refreshIntervalMs = 60 * 1000
const defaultHealthySeconds = 12
const maxHealthySeconds = 300

export function ChannelMonitor() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [healthySeconds, setHealthySeconds] = useState(
    defaultHealthySeconds.toString()
  )
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
  const savedHealthySeconds = Math.round(
    (statusQuery.data?.data.degraded_latency_ms ??
      defaultHealthySeconds * 1000) / 1000
  )

  useEffect(() => {
    start()
  }, [start, statusQuery.dataUpdatedAt])

  useEffect(() => {
    setHealthySeconds(savedHealthySeconds.toString())
  }, [savedHealthySeconds])

  const visibilityMutation = useMutation({
    mutationFn: async (variables: { channelId: number; visible: boolean }) =>
      requireServerSuccess(
        await updateChannelStatusVisibility(
          variables.channelId,
          variables.visible
        )
      ),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['channel-monitor-status'] })
      const previous = queryClient.getQueryData<ChannelStatusResponse>([
        'channel-monitor-status',
      ])
      queryClient.setQueryData<ChannelStatusResponse>(
        ['channel-monitor-status'],
        (current) => {
          if (!current) return current
          return {
            ...current,
            data: {
              ...current.data,
              items: current.data.items.map((item) =>
                item.channel_id === variables.channelId
                  ? { ...item, visible: variables.visible }
                  : item
              ),
            },
          }
        }
      )
      return { previous }
    },
    onSuccess: () => {
      toast.success(t('Updated successfully'))
      queryClient.invalidateQueries({ queryKey: ['channel-status'] })
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['channel-monitor-status'], context.previous)
      }
      handleServerError(error, t('Failed to update setting'))
    },
  })

  const activeTestMutation = useMutation({
    mutationFn: async (variables: { channelId: number; enabled: boolean }) =>
      requireServerSuccess(
        await updateChannelActiveTestEnabled(
          variables.channelId,
          variables.enabled
        )
      ),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['channel-monitor-status'] })
      const previous = queryClient.getQueryData<ChannelStatusResponse>([
        'channel-monitor-status',
      ])
      queryClient.setQueryData<ChannelStatusResponse>(
        ['channel-monitor-status'],
        (current) => {
          if (!current) return current
          return {
            ...current,
            data: {
              ...current.data,
              items: current.data.items.map((item) =>
                item.channel_id === variables.channelId
                  ? { ...item, active_test_enabled: variables.enabled }
                  : item
              ),
            },
          }
        }
      )
      return { previous }
    },
    onSuccess: () => {
      toast.success(t('Updated successfully'))
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['channel-monitor-status'], context.previous)
      }
      handleServerError(error, t('Failed to update setting'))
    },
  })

  const clearTestDataMutation = useMutation({
    mutationFn: async (channelId: number) =>
      requireServerSuccess(await clearChannelTestData(channelId)),
    onSuccess: (_response, channelId) => {
      queryClient.setQueryData<ChannelStatusResponse>(
        ['channel-monitor-status'],
        (current) => {
          if (!current) return current
          return {
            ...current,
            data: {
              ...current.data,
              items: current.data.items.map((item) =>
                item.channel_id === channelId
                  ? {
                      ...item,
                      health: 'unknown',
                      latency_ms: 0,
                      recent_success_rate: 0,
                      availability_7d: 0,
                      availability_15d: 0,
                      availability_30d: 0,
                      availability_7d_samples: 0,
                      availability_15d_samples: 0,
                      availability_30d_samples: 0,
                      avg_latency_7d_ms: undefined,
                      latest_checked_at: 0,
                      records: [],
                    }
                  : item
              ),
            },
          }
        }
      )
      queryClient.invalidateQueries({ queryKey: ['channel-monitor-status'] })
      queryClient.invalidateQueries({ queryKey: ['channel-status'] })
      toast.success(t('Test data cleared'))
    },
    onError: (error) => {
      handleServerError(error, t('Failed to clear test data'))
    },
  })

  const thresholdMutation = useMutation({
    mutationFn: async (seconds: number) =>
      requireServerSuccess(await updateChannelStatusHealthyThreshold(seconds)),
    onSuccess: (response) => {
      queryClient.setQueryData<ChannelStatusResponse>(
        ['channel-monitor-status'],
        (current) =>
          current
            ? {
                ...current,
                data: {
                  ...current.data,
                  degraded_latency_ms: response.data.degraded_latency_ms,
                },
              }
            : current
      )
      queryClient.invalidateQueries({ queryKey: ['channel-status'] })
      toast.success(t('Setting updated successfully'))
    },
    onError: (error) => {
      handleServerError(error, t('Failed to update setting'))
    },
  })

  const parsedHealthySeconds = Number(healthySeconds)
  const healthySecondsValid =
    Number.isInteger(parsedHealthySeconds) &&
    parsedHealthySeconds >= 1 &&
    parsedHealthySeconds <= maxHealthySeconds
  const handleVisibilityChange = useCallback(
    (channelId: number, visible: boolean) => {
      visibilityMutation.mutate({ channelId, visible })
    },
    [visibilityMutation]
  )
  const handleActiveTestChange = useCallback(
    (channelId: number, enabled: boolean) => {
      activeTestMutation.mutate({ channelId, enabled })
    },
    [activeTestMutation]
  )
  const handleClearTestData = useCallback(
    async (channelId: number) => {
      await clearTestDataMutation.mutateAsync(channelId)
    },
    [clearTestDataMutation]
  )

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>
        {t('Channel Monitoring')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <div className='flex items-center gap-2'>
          <label
            htmlFor='channel-status-healthy-seconds'
            className='text-muted-foreground text-xs whitespace-nowrap'
          >
            {t('Healthy below (seconds)')}
          </label>
          <Input
            id='channel-status-healthy-seconds'
            type='number'
            min={1}
            max={maxHealthySeconds}
            step={1}
            className='w-20'
            value={healthySeconds}
            aria-invalid={!healthySecondsValid}
            onChange={(event) => setHealthySeconds(event.target.value)}
          />
          <Button
            size='sm'
            disabled={
              !healthySecondsValid ||
              parsedHealthySeconds === savedHealthySeconds ||
              thresholdMutation.isPending
            }
            onClick={() => thresholdMutation.mutate(parsedHealthySeconds)}
          >
            {t('Save')}
          </Button>
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
        <div className='h-full min-h-0 overflow-y-auto'>
          {statusQuery.isLoading ? <LoadingState /> : null}
          {statusQuery.isError ? (
            <ErrorState
              description={t('Please try again later.')}
              onRetry={() => void statusQuery.refetch()}
            />
          ) : null}
          {statusQuery.data ? (
            <ChannelMonitorTable
              rows={statusQuery.data.data.items}
              pendingClearChannelId={
                clearTestDataMutation.isPending
                  ? clearTestDataMutation.variables
                  : undefined
              }
              pendingActiveTestChannelId={
                activeTestMutation.isPending
                  ? activeTestMutation.variables.channelId
                  : undefined
              }
              pendingChannelId={
                visibilityMutation.isPending
                  ? visibilityMutation.variables.channelId
                  : undefined
              }
              onActiveTestChange={handleActiveTestChange}
              onClearTestData={handleClearTestData}
              onVisibilityChange={handleVisibilityChange}
            />
          ) : null}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
