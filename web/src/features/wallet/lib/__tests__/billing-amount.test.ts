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
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { canShowTopupInvoiceStatus, formatTopupRecordAmount } from '../billing'

beforeEach(() => {
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...DEFAULT_CURRENCY_CONFIG,
      quotaDisplayType: 'CNY',
      quotaPerUnit: 500000,
      usdExchangeRate: 1,
    },
  })
})

afterEach(() => {
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG },
  })
})

describe('top-up billing amount formatting', () => {
  test('formats redemption top-up amount as raw quota', () => {
    expect(
      formatTopupRecordAmount({
        amount: 5000000,
        payment_method: 'redemption',
        payment_provider: 'redemption',
        redemption_id: 11,
      })
    ).toBe('¥10')
  })

  test('keeps regular online top-up amount as money units', () => {
    expect(
      formatTopupRecordAmount({
        amount: 10,
        payment_method: 'alipay',
        payment_provider: 'epay',
        redemption_id: null,
      })
    ).toBe('¥10')
  })

  test('formats Creem top-up amount as raw quota', () => {
    expect(
      formatTopupRecordAmount({
        amount: 5000000,
        payment_method: 'creem',
        payment_provider: 'creem',
        redemption_id: null,
      })
    ).toBe('¥10')
  })
})

describe('top-up invoice status visibility', () => {
  test('hides invoice controls for successful orders that are not invoiceable', () => {
    expect(
      canShowTopupInvoiceStatus({
        status: 'success',
        invoice_available: false,
      })
    ).toBe(false)
  })

  test('shows invoice controls for successful invoiceable orders', () => {
    expect(
      canShowTopupInvoiceStatus({
        status: 'success',
        invoice_available: true,
      })
    ).toBe(true)
  })

  test('hides invoice controls before an invoiceable order succeeds', () => {
    expect(
      canShowTopupInvoiceStatus({
        status: 'pending',
        invoice_available: true,
      })
    ).toBe(false)
  })
})
