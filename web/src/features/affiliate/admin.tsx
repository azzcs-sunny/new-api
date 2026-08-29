/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { SectionPageLayout } from '@/components/layout'
import { getAffiliateRelations } from '@/features/wallet/api'
import type { AffiliateRelationItem } from '@/features/wallet/types'
import { formatQuota, formatTimestampToDate } from '@/lib/format'

export function AffiliateAdmin() {
  const { t } = useTranslation()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const relationsQuery = useQuery({
    queryKey: [
      'affiliate-admin-relations',
      pagination.pageIndex + 1,
      pagination.pageSize,
    ],
    queryFn: async () => {
      const response = await getAffiliateRelations(
        pagination.pageIndex + 1,
        pagination.pageSize
      )
      return response.data ?? { items: [], total: 0 }
    },
    placeholderData: (previous) => previous,
  })

  const columns = useMemo<ColumnDef<AffiliateRelationItem, unknown>[]>(
    () => [
      {
        accessorKey: 'inviter_id',
        header: t('Inviter ID'),
        cell: ({ row }) => (
          <span className='font-mono tabular-nums'>
            {row.original.inviter_id}
          </span>
        ),
      },
      {
        accessorKey: 'inviter_username',
        header: t('Inviter Username'),
      },
      {
        accessorKey: 'invitee_id',
        header: t('Invitee ID'),
        cell: ({ row }) => (
          <span className='font-mono tabular-nums'>
            {row.original.invitee_id}
          </span>
        ),
      },
      {
        accessorKey: 'invitee_username',
        header: t('Invitee Username'),
      },
      {
        accessorKey: 'joined_at',
        header: t('Joined At'),
        cell: ({ row }) => formatTimestampToDate(row.original.joined_at),
      },
      {
        accessorKey: 'top_up_count',
        header: t('Top-ups'),
      },
      {
        accessorKey: 'reward_quota',
        header: t('Reward Earned'),
        cell: ({ row }) => formatQuota(row.original.reward_quota),
      },
      {
        accessorKey: 'frozen_quota',
        header: t('Frozen Reward'),
        cell: ({ row }) => formatQuota(row.original.frozen_quota),
      },
    ],
    [t]
  )

  const { table } = useDataTable({
    data: relationsQuery.data?.items ?? [],
    columns,
    totalCount: relationsQuery.data?.total ?? 0,
    manualPagination: true,
    pagination,
    onPaginationChange: setPagination,
    withFilteredRowModel: false,
    withSortedRowModel: false,
  })

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>
        {t('Referral Relations')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <DataTablePage
          table={table}
          columns={columns}
          isLoading={relationsQuery.isLoading}
          isFetching={relationsQuery.isFetching}
          emptyTitle={t('No referral relations yet')}
          emptyDescription={t(
            'Referral bindings and rewards will appear here after users join.'
          )}
          skeletonKeyPrefix='affiliate-admin-relations'
          toolbar={null}
          applyHeaderSize
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
