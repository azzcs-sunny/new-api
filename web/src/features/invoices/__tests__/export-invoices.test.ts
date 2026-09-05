/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, test } from 'vitest'

import { buildProcessingInvoiceExportRows } from '../lib/export-invoices'
import type { Invoice } from '../types'

function createInvoice(id: number, status: string): Invoice {
  return {
    id,
    user_id: 8,
    invoice_type: 'normal',
    buyer_type: 'company',
    title: 'Example Company',
    tax_number: 'TAX-001',
    email: 'billing@example.com',
    phone: '123',
    address: 'Address',
    bank_name: 'Bank',
    bank_account: 'Account',
    amount: 99,
    status,
    reject_reason: '',
    invoice_number: '',
    file_url: '',
    create_time: 1_700_000_000,
    issue_time: 0,
    orders: [
      {
        id: 1,
        invoice_id: id,
        topup_id: 2,
        topup: {
          trade_no: 'TOPUP-001',
          money: 99,
          create_time: 1_699_999_000,
        },
      },
    ],
  }
}

describe('invoice Excel rows', () => {
  test('exports only processing invoices with the required nine columns', () => {
    const rows = buildProcessingInvoiceExportRows(
      [createInvoice(1, 'processing'), createInvoice(2, 'pending')],
      (key) => key
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      'Invoice ID': 1,
      'User ID': 8,
      'Title type': 'Unit',
      'Invoice title': 'Example Company',
      'Tax number': 'TAX-001',
      Email: 'billing@example.com',
      'Top-up orders': 'TOPUP-001',
      Amount: 99,
    })
    expect(Object.keys(rows[0])).toEqual([
      'Invoice ID',
      'User ID',
      'Title type',
      'Invoice title',
      'Tax number',
      'Email',
      'Top-up orders',
      'Amount',
      'Submitted at',
    ])
  })
})
