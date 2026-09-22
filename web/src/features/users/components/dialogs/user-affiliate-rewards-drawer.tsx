/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePagination,
  DataTableView,
  useDataTable,
} from '@/components/data-table'
import {
  sideDrawerContentClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import { formatQuota, formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import { getUserAffiliateRewards } from '../../api'
import type { User, UserAffiliateReward } from '../../types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User
}

export function UserAffiliateRewardsDrawer({
  open,
  onOpenChange,
  user,
}: Props) {
  const { t } = useTranslation()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [range, setRange] = useState<{ start?: Date; end?: Date }>({})

  useEffect(() => {
    if (!open) return
    setPagination({ pageIndex: 0, pageSize: 10 })
    setRange({})
  }, [open, user.id])

  const rewardsQuery = useQuery({
    queryKey: [
      'admin-user-affiliate-rewards',
      user.id,
      pagination.pageIndex + 1,
      pagination.pageSize,
      range.start?.getTime(),
      range.end?.getTime(),
    ],
    queryFn: async () => {
      const response = await getUserAffiliateRewards(
        user.id,
        pagination.pageIndex + 1,
        pagination.pageSize,
        range.start,
        range.end
      )
      return (
        response.data ?? {
          page: 1,
          page_size: pagination.pageSize,
          total: 0,
          range_reward_quota: 0,
          items: [],
        }
      )
    },
    enabled: open,
    placeholderData: (previous) => previous,
  })

  const columns = useMemo<ColumnDef<UserAffiliateReward, unknown>[]>(
    () => [
      {
        accessorKey: 'invitee_username',
        header: t('Invited User'),
        cell: ({ row }) => (
          <div>
            <div className='font-medium'>
              {row.original.invitee_username || '-'}
            </div>
            <div className='text-muted-foreground font-mono text-xs'>
              ID: {row.original.invitee_id}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'base_quota',
        header: t('Eligible Amount'),
        cell: ({ row }) => formatQuota(row.original.base_quota),
      },
      {
        accessorKey: 'ratio',
        header: t('Reward Ratio'),
        cell: ({ row }) => `${(row.original.ratio * 100).toFixed(2)}%`,
      },
      {
        accessorKey: 'reward_quota',
        header: t('Amount Earned'),
        cell: ({ row }) => formatQuota(row.original.reward_quota),
      },
      {
        accessorKey: 'created_at',
        header: t('Earned At'),
        cell: ({ row }) => formatTimestampToDate(row.original.created_at),
      },
    ],
    [t]
  )

  const { table } = useDataTable({
    data: rewardsQuery.data?.items ?? [],
    columns,
    totalCount: rewardsQuery.data?.total ?? 0,
    manualPagination: true,
    pagination,
    onPaginationChange: setPagination,
    withFilteredRowModel: false,
    withSortedRowModel: false,
  })

  let rewardsContent: ReactNode
  if (rewardsQuery.isLoading) {
    rewardsContent = (
      <div className='flex min-h-0 flex-1 flex-col gap-2'>
        <Skeleton className='h-10 w-full' />
        <Skeleton className='min-h-0 flex-1' />
      </div>
    )
  } else if (rewardsQuery.isError) {
    rewardsContent = (
      <Alert variant='destructive'>
        <AlertDescription>
          {t('Failed to load referral rewards')}
        </AlertDescription>
        <Button
          variant='outline'
          size='sm'
          className='mt-3'
          onClick={() => void rewardsQuery.refetch()}
        >
          {t('Retry')}
        </Button>
      </Alert>
    )
  } else {
    rewardsContent = (
      <div className='flex min-h-0 flex-1 flex-col gap-2.5'>
        <DataTableView
          table={table}
          emptyTitle={t('No referral rewards in this range')}
          splitHeader
          tableContainerClassName='h-full min-h-0'
          containerClassName={cn(
            'min-h-0 flex-1 transition-opacity duration-150',
            rewardsQuery.isFetching && 'pointer-events-none opacity-60'
          )}
        />
        <DataTablePagination table={table} />
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={sideDrawerContentClassName('sm:max-w-5xl')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>{t('Referral Rewards')}</SheetTitle>
          <SheetDescription>
            {user.username} (ID: {user.id})
          </SheetDescription>
        </SheetHeader>
        <div className='flex min-h-0 flex-1 flex-col gap-3 p-4'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <CompactDateTimeRangePicker
              start={range.start}
              end={range.end}
              onChange={(nextRange) => {
                setRange(nextRange)
                setPagination((current) => ({ ...current, pageIndex: 0 }))
              }}
              className='sm:w-auto'
            />
            <div className='text-sm'>
              <span className='text-muted-foreground'>
                {t('Total in range')}:{' '}
              </span>
              <span className='font-semibold tabular-nums'>
                {formatQuota(rewardsQuery.data?.range_reward_quota ?? 0)}
              </span>
            </div>
          </div>
          {rewardsContent}
        </div>
      </SheetContent>
    </Sheet>
  )
}
