/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getAffiliateRewardAdminDetails,
  getAffiliateRewardDetails,
} from '@/features/wallet/api'
import type {
  AffiliateRewardAdminDetailItem,
  AffiliateRewardDetailItem,
  AffiliateRewardDetailsPage,
} from '@/features/wallet/types'
import { formatQuota, formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

type RewardDetailsDrawerProps = {
  open: boolean
  inviteeId: number | null
  inviterId?: number
  admin?: boolean
  onOpenChange: (open: boolean) => void
}

export function RewardDetailsDrawer(props: RewardDetailsDrawerProps) {
  const { t } = useTranslation()
  const inviteeId = props.inviteeId ?? 0
  const inviterId = props.inviterId ?? 0
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  useEffect(() => {
    setPagination({ pageIndex: 0, pageSize: 10 })
  }, [inviteeId, inviterId, props.admin])

  const detailsQuery = useQuery({
    queryKey: [
      'affiliate-reward-details',
      props.admin ? 'admin' : 'user',
      inviterId,
      inviteeId,
      pagination.pageIndex + 1,
      pagination.pageSize,
    ],
    queryFn: async (): Promise<AffiliateRewardDetailsPage> => {
      if (props.admin) {
        const response = await getAffiliateRewardAdminDetails(
          inviterId,
          inviteeId,
          pagination.pageIndex + 1,
          pagination.pageSize
        )
        return (
          response.data ?? {
            page: pagination.pageIndex + 1,
            page_size: pagination.pageSize,
            total: 0,
            items: [],
          }
        )
      }
      const response = await getAffiliateRewardDetails(
        inviteeId,
        pagination.pageIndex + 1,
        pagination.pageSize
      )
      return (
        response.data ?? {
          page: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
          total: 0,
          items: [],
        }
      )
    },
    enabled: props.open && inviteeId > 0 && (!props.admin || inviterId > 0),
  })

  const columns = useMemo<ColumnDef<AffiliateRewardDetailItem, unknown>[]>(
    () => {
      const detailColumns: ColumnDef<AffiliateRewardDetailItem, unknown>[] = []
      if (props.admin) {
        detailColumns.push(
          {
            id: 'trade_no',
            header: t('Order Number'),
            cell: ({ row }) => (
              <span className='block max-w-48 truncate font-mono text-xs'>
                {(row.original as AffiliateRewardAdminDetailItem).trade_no ||
                  '-'}
              </span>
            ),
          },
          {
            id: 'base_quota',
            header: t('Credited Amount'),
            cell: ({ row }) =>
              formatQuota(
                (row.original as AffiliateRewardAdminDetailItem).base_quota
              ),
          }
        )
      }
      detailColumns.push({
        id: 'sequence',
        header: t('Top-up No.'),
        cell: ({ row }) => row.original.sequence,
      })
      detailColumns.push({
        id: 'reward_quota',
        header: t('Amount Earned'),
        cell: ({ row }) => formatQuota(row.original.reward_quota),
      })
      detailColumns.push({
        id: 'ratio',
        header: t('Reward Ratio'),
        cell: ({ row }) => `${(row.original.ratio * 100).toFixed(2)}%`,
      })
      detailColumns.push({
        id: 'status',
        header: t('Status'),
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === 'frozen' ? 'warning' : 'outline'}
          >
            {row.original.status === 'frozen'
              ? t('Frozen')
              : t('Available')}
          </Badge>
        ),
      })
      detailColumns.push({
        id: 'created_at',
        header: t('Earned At'),
        cell: ({ row }) => formatTimestampToDate(row.original.created_at),
      })
      return detailColumns
    },
    [props.admin, t]
  )

  const { table } = useDataTable({
    data: detailsQuery.data?.items ?? [],
    columns,
    totalCount: detailsQuery.data?.total ?? 0,
    manualPagination: true,
    pagination,
    onPaginationChange: setPagination,
    withFilteredRowModel: false,
    withSortedRowModel: false,
  })

  let detailsContent: ReactNode
  if (detailsQuery.isLoading) {
    detailsContent = (
      <div
        className='flex min-h-0 flex-1 flex-col gap-2'
        aria-label={t('Loading details')}
      >
        <Skeleton className='h-10 w-full' />
        <Skeleton className='min-h-0 w-full flex-1' />
      </div>
    )
  } else if (detailsQuery.isError) {
    detailsContent = (
      <Alert variant='destructive'>
        <AlertDescription>{t('Failed to load details')}</AlertDescription>
        <Button
          variant='outline'
          size='sm'
          className='mt-3'
          onClick={() => void detailsQuery.refetch()}
        >
          {t('Retry')}
        </Button>
      </Alert>
    )
  } else {
    detailsContent = (
      <div className='flex min-h-0 flex-1 flex-col gap-2.5'>
        <DataTableView
          table={table}
          emptyTitle={t('No earning details yet')}
          splitHeader
          tableContainerClassName='h-full min-h-0'
          containerClassName={cn(
            'min-h-0 w-full flex-1 transition-opacity duration-150',
            detailsQuery.isFetching && 'pointer-events-none opacity-60'
          )}
          tableClassName='w-full'
        />
        <div className='shrink-0'>
          <DataTablePagination table={table} />
        </div>
      </div>
    )
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className={sideDrawerContentClassName('sm:max-w-4xl')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>{t('Earning Details')}</SheetTitle>
          <SheetDescription>
            {t('Invited User ID')}: {props.inviteeId ?? '-'}
          </SheetDescription>
        </SheetHeader>
        <div className='flex min-h-0 w-full flex-1 flex-col overflow-hidden p-4 sm:p-6'>
          {detailsContent}
        </div>
      </SheetContent>
    </Sheet>
  )
}
