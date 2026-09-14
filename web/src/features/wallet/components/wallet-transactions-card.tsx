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
import {
  BanknoteArrowDown,
  ChevronLeft,
  ChevronRight,
  Gift,
  History,
  ReceiptText,
  ShieldUser,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

import { useWalletTransactions } from '../hooks/use-wallet-transactions'
import {
  formatTimestamp,
  getPaymentMethodName,
  getStatusConfig,
} from '../lib/billing'
import type { WalletTransaction, WalletTransactionSource } from '../types'

const PAGE_SIZE = 10

const SOURCE_LABELS: Record<WalletTransactionSource, string> = {
  online_topup: 'Online top-up',
  redemption: 'Redemption Code',
  admin_adjustment: 'Administrator adjustment',
}

function TransactionSourceIcon(props: { source: WalletTransactionSource }) {
  if (props.source === 'redemption') return <Gift className='h-4 w-4' />
  if (props.source === 'admin_adjustment') {
    return <ShieldUser className='h-4 w-4' />
  }
  return <ReceiptText className='h-4 w-4' />
}

function getAdjustmentLabel(record: WalletTransaction): string | null {
  if (record.source !== 'admin_adjustment') return null
  if (record.adjustment_mode === 'add') return 'Administrator credit'
  if (record.adjustment_mode === 'subtract') {
    return 'Administrator deduction'
  }
  return 'Administrator balance update'
}

export function WalletTransactionsCard() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const transactionsQuery = useWalletTransactions(page, PAGE_SIZE)
  const records = transactionsQuery.data?.items ?? []
  const total = transactionsQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  let content: ReactNode
  if (transactionsQuery.isLoading) {
    content = (
      <div className='space-y-3 p-3 sm:p-5'>
        {[1, 2, 3].map((item) => (
          <div key={item} className='flex items-center gap-3 py-2'>
            <Skeleton className='h-9 w-9 rounded-full' />
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-4 w-40' />
              <Skeleton className='h-3 w-64 max-w-full' />
            </div>
            <Skeleton className='h-5 w-20' />
          </div>
        ))}
      </div>
    )
  } else if (transactionsQuery.isError) {
    content = (
      <div className='flex min-h-36 flex-col items-center justify-center gap-3 p-5 text-center'>
        <p className='text-muted-foreground text-sm'>
          {t('Failed to load balance history')}
        </p>
        <Button
          variant='outline'
          size='sm'
          onClick={() => transactionsQuery.refetch()}
        >
          {t('Retry')}
        </Button>
      </div>
    )
  } else if (records.length === 0) {
    content = (
      <div className='text-muted-foreground flex min-h-40 flex-col items-center justify-center p-5 text-center'>
        <BanknoteArrowDown className='mb-3 h-8 w-8 opacity-50' />
        <p className='text-foreground text-sm font-medium'>
          {t('No balance changes yet')}
        </p>
        <p className='mt-1 max-w-md text-xs'>
          {t(
            'Balance changes will appear here after a top-up, redemption, or administrator update.'
          )}
        </p>
      </div>
    )
  } else {
    content = (
      <>
        <ul className='divide-y'>
          {records.map((record) => {
            const statusConfig = getStatusConfig(record.status)
            const adjustmentLabel = getAdjustmentLabel(record)
            const isNegative = record.amount < 0
            const isCredited = record.status === 'success'
            let amountPrefix = ''
            let amountClassName = 'text-muted-foreground'
            if (isNegative) {
              amountPrefix = '−'
              amountClassName = 'text-destructive'
            } else if (isCredited) {
              amountPrefix = '+'
              amountClassName = 'text-emerald-600 dark:text-emerald-400'
            }
            return (
              <li
                key={record.id}
                className='flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-5'
              >
                <div className='bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full'>
                  <TransactionSourceIcon source={record.source} />
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='text-sm font-medium'>
                      {t(adjustmentLabel || SOURCE_LABELS[record.source])}
                    </span>
                    <StatusBadge
                      label={t(statusConfig.label)}
                      variant={statusConfig.variant}
                      size='sm'
                      showDot
                      copyable={false}
                    />
                  </div>
                  <div className='text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs'>
                    <span>{formatTimestamp(record.create_time)}</span>
                    {record.trade_no && (
                      <span className='truncate font-mono'>
                        {t('Order Number')}: {record.trade_no}
                      </span>
                    )}
                    {record.payment_method && (
                      <span>
                        {t('Payment Method')}:{' '}
                        {getPaymentMethodName(record.payment_method, t)}
                      </span>
                    )}
                    {record.money != null && (
                      <span>
                        {t('Payment')}: {formatNumber(record.money)}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={cn(
                    'shrink-0 text-right text-base font-semibold tabular-nums',
                    amountClassName
                  )}
                >
                  {amountPrefix}
                  {formatQuotaWithCurrency(Math.abs(record.amount), {
                    digitsLarge: 2,
                    digitsSmall: 2,
                    abbreviate: false,
                  })}
                </div>
              </li>
            )
          })}
        </ul>
        {totalPages > 1 && (
          <div className='flex items-center justify-between border-t p-3 sm:px-5'>
            <span className='text-muted-foreground text-xs'>
              {t('Page')} {page} / {totalPages}
            </span>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setPage((current) => current - 1)}
                disabled={page <= 1 || transactionsQuery.isFetching}
                aria-label={t('Previous')}
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= totalPages || transactionsQuery.isFetching}
                aria-label={t('Next')}
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <TitledCard
      title={t('Balance History')}
      description={t(
        'Review every balance change from payments, redemption codes, and administrator updates.'
      )}
      icon={<History className='h-4 w-4' />}
      iconTone='info'
      disableHoverEffect
      contentClassName='p-0'
    >
      {content}
    </TitledCard>
  )
}
