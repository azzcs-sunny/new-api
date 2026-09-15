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
import type { StatusBadgeProps } from '@/components/status-badge'
import {
  formatCurrencyFromUSD,
  formatQuotaWithCurrency,
  type CurrencyFormatOptions,
} from '@/lib/currency'
import { formatTimestampToDate } from '@/lib/format'

import type { TopupRecord, TopupStatus } from '../types'

// ============================================================================
// Billing Utility Functions
// ============================================================================

interface StatusConfig {
  variant: StatusBadgeProps['variant']
  label: string
}

const TOPUP_AMOUNT_OPTIONS: CurrencyFormatOptions = {
  digitsLarge: 2,
  digitsSmall: 2,
  abbreviate: false,
}

/**
 * Status badge configuration
 */
export const STATUS_CONFIG: Record<TopupStatus, StatusConfig> = {
  success: {
    variant: 'success',
    label: 'Success',
  },
  pending: {
    variant: 'warning',
    label: 'Pending',
  },
  expired: {
    variant: 'danger',
    label: 'Expired',
  },
  failed: {
    variant: 'danger',
    label: 'Failed',
  },
}

/**
 * Get status badge configuration
 */
export function getStatusConfig(status: TopupStatus): StatusConfig {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending
}

/**
 * Payment method display names
 */
export const PAYMENT_METHOD_NAMES: Record<string, string> = {
  stripe: 'Stripe',
  alipay: 'Alipay',
  wxpay: 'WeChat Pay',
  waffo: 'Waffo',
  waffo_pancake: 'Waffo Pancake',
  creem: 'Creem',
  balance: 'Balance',
  redemption: 'Redemption Code',
}

/**
 * Get payment method display name
 */
export function getPaymentMethodName(
  method: string,
  t?: (key: string) => string
): string {
  const name = PAYMENT_METHOD_NAMES[method] || method
  return t ? t(name) : name
}

function isRawQuotaAmount(
  record: Pick<
    TopupRecord,
    'payment_method' | 'payment_provider' | 'redemption_id'
  >
): boolean {
  return (
    record.payment_method === 'redemption' ||
    record.payment_provider === 'redemption' ||
    record.redemption_id != null ||
    record.payment_method === 'creem' ||
    record.payment_provider === 'creem'
  )
}

export function formatTopupRecordAmount(
  record: Pick<
    TopupRecord,
    'amount' | 'payment_method' | 'payment_provider' | 'redemption_id'
  >
): string {
  if (isRawQuotaAmount(record)) {
    return formatQuotaWithCurrency(record.amount, TOPUP_AMOUNT_OPTIONS)
  }
  return formatCurrencyFromUSD(record.amount, TOPUP_AMOUNT_OPTIONS)
}

export function canShowTopupInvoiceStatus(
  record: Pick<TopupRecord, 'status' | 'invoice_available'>
): boolean {
  return record.status === 'success' && record.invoice_available
}

/**
 * Format timestamp to readable date string
 */
export function formatTimestamp(timestamp: number): string {
  return formatTimestampToDate(timestamp)
}
