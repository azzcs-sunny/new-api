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

For commercial licensing, please contact support@quantumnous.com
*/
import { ViewIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { Copy, Gift, Share2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getAffiliateRewards } from '@/features/wallet/api'
import { TransferDialog } from '@/features/wallet/components/dialogs/transfer-dialog'
import { useAffiliate } from '@/features/wallet/hooks/use-affiliate'
import { useTopupInfo } from '@/features/wallet/hooks/use-topup-info'
import type {
  AffiliateRewardItem,
  UserWalletData,
} from '@/features/wallet/types'
import { getSelf } from '@/lib/api'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { formatQuota, formatTimestampToDate } from '@/lib/format'

import { RewardDetailsDrawer } from './components/reward-details-drawer'

export function Affiliate() {
  const { t } = useTranslation()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [transferOpen, setTransferOpen] = useState(false)
  const [detailsInviteeId, setDetailsInviteeId] = useState<number | null>(null)
  const { topupInfo } = useTopupInfo()
  const {
    affiliateLink,
    loading: linkLoading,
    transferQuota,
    transferring,
  } = useAffiliate()

  const userQuery = useQuery({
    queryKey: ['affiliate-self'],
    queryFn: async () => {
      const response = await getSelf()
      return (response.data ?? null) as UserWalletData | null
    },
  })
  const rewardsQuery = useQuery({
    queryKey: [
      'affiliate-rewards',
      pagination.pageIndex + 1,
      pagination.pageSize,
    ],
    queryFn: async () => {
      const response = await getAffiliateRewards(
        pagination.pageIndex + 1,
        pagination.pageSize
      )
      return response.data ?? { items: [], total: 0, frozen_quota: 0, ratio: 0 }
    },
    placeholderData: (previous) => previous,
  })

  const columns = useMemo<ColumnDef<AffiliateRewardItem, unknown>[]>(
    () => [
      {
        accessorKey: 'invitee_id',
        header: t('Invited User ID'),
        cell: ({ row }) => (
          <span className='font-mono tabular-nums'>
            {row.original.invitee_id}
          </span>
        ),
      },
      {
        accessorKey: 'joined_at',
        header: t('Joined At'),
        cell: ({ row }) => formatTimestampToDate(row.original.joined_at),
      },
      {
        accessorKey: 'top_up_count',
        header: t('Top-ups'),
        cell: ({ row }) => `${row.original.top_up_count}/3`,
      },
      {
        accessorKey: 'reward_quota',
        header: t('Amount Earned'),
        cell: ({ row }) => formatQuota(row.original.reward_quota),
      },
      {
        accessorKey: 'frozen_quota',
        header: t('Frozen Amount'),
        cell: ({ row }) => formatQuota(row.original.frozen_quota),
      },
      {
        accessorKey: 'last_reward_at',
        header: t('Last Earned At'),
        cell: ({ row }) => formatTimestampToDate(row.original.last_reward_at),
      },
      {
        id: 'actions',
        header: t('Details'),
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant='ghost'
                  size='icon-sm'
                  aria-label={t('View details')}
                  onClick={() => setDetailsInviteeId(row.original.invitee_id)}
                />
              }
            >
              <HugeiconsIcon icon={ViewIcon} strokeWidth={2} />
            </TooltipTrigger>
            <TooltipContent>{t('View details')}</TooltipContent>
          </Tooltip>
        ),
        meta: { pinned: 'right' as const },
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

  const handleTransfer = useCallback(
    async (amount: number) => {
      const success = await transferQuota(amount)
      if (success) {
        await userQuery.refetch()
      }
      return success
    },
    [transferQuota, userQuery]
  )
  const user = userQuery.data
  const complianceConfirmed = topupInfo?.payment_compliance_confirmed !== false

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Referral Program')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='flex h-full min-h-0 w-full flex-col gap-4 sm:gap-5'>
            <Card className='w-full shrink-0'>
              <CardHeader className='pb-3'>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <IconBadge tone='chart-3'>
                    <Share2 />
                  </IconBadge>
                  {t('Share your referral link')}
                </CardTitle>
              </CardHeader>
              <CardContent className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end'>
                <div className='flex min-w-0 gap-2'>
                  {linkLoading ? (
                    <Skeleton className='h-9 flex-1' />
                  ) : (
                    <Input
                      value={affiliateLink}
                      readOnly
                      className='min-w-0 flex-1 font-mono text-xs'
                    />
                  )}
                  <Button
                    variant='outline'
                    size='icon'
                    aria-label={t('Copy referral link')}
                    title={t('Copy referral link')}
                    disabled={!affiliateLink}
                    onClick={() => void copyToClipboard(affiliateLink)}
                  >
                    <Copy />
                  </Button>
                </div>
                <div className='grid grid-cols-2 gap-4 text-center sm:grid-cols-5 lg:min-w-[520px]'>
                  <div>
                    <div className='text-muted-foreground text-xs'>
                      {t('Pending')}
                    </div>
                    <div className='font-semibold tabular-nums'>
                      {formatQuota(user?.aff_quota ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className='text-muted-foreground text-xs'>
                      {t('Total Earned')}
                    </div>
                    <div className='font-semibold tabular-nums'>
                      {formatQuota(user?.aff_history_quota ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className='text-muted-foreground text-xs'>
                      {t('Invites')}
                    </div>
                    <div className='font-semibold tabular-nums'>
                      {rewardsQuery.data?.total ?? 0}
                    </div>
                  </div>
                  <div>
                    <div className='text-muted-foreground text-xs'>
                      {t('Frozen')}
                    </div>
                    <div className='font-semibold tabular-nums'>
                      {formatQuota(rewardsQuery.data?.frozen_quota ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className='text-muted-foreground text-xs'>
                      {t('Reward Ratio')}
                    </div>
                    <div className='font-semibold tabular-nums'>
                      {((rewardsQuery.data?.ratio ?? 0) * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>
                <p className='text-muted-foreground text-xs lg:col-span-2'>
                  {t(
                    'The first three successful top-ups from each invited user earn a rebate.'
                  )}
                </p>
                <p className='text-muted-foreground text-xs lg:col-span-2'>
                  {t(
                    'New rewards remain frozen for 24 hours before they become available for transfer.'
                  )}
                </p>
                <p className='text-destructive text-xs lg:col-span-2'>
                  {t(
                    'Referral rewards cannot be withdrawn and can only be used on this platform.'
                  )}
                </p>
                {user?.aff_quota ? (
                  <Button
                    className='w-full sm:w-auto lg:col-start-2 lg:justify-self-end'
                    disabled={!complianceConfirmed}
                    onClick={() => setTransferOpen(true)}
                  >
                    <Gift />
                    {t('Transfer to Balance')}
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <DataTablePage
              table={table}
              columns={columns}
              isLoading={rewardsQuery.isLoading}
              isFetching={rewardsQuery.isFetching}
              emptyTitle={t('No referred users yet')}
              emptyDescription={t(
                'Share your referral link to start earning rewards.'
              )}
              skeletonKeyPrefix='affiliate-rewards'
              toolbar={null}
            />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        onConfirm={handleTransfer}
        availableQuota={user?.aff_quota ?? 0}
        transferring={transferring}
      />
      <RewardDetailsDrawer
        open={detailsInviteeId !== null}
        inviteeId={detailsInviteeId}
        onOpenChange={(open) => {
          if (!open) setDetailsInviteeId(null)
        }}
      />
    </>
  )
}
