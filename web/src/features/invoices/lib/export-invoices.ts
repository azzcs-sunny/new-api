/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import type { Invoice } from '../types'

type Translate = (key: string) => string

export function buildProcessingInvoiceExportRows(
  invoices: Invoice[],
  t: Translate
) {
  return invoices
    .filter((invoice) => invoice.status === 'processing')
    .map((invoice) => ({
      [t('Invoice ID')]: invoice.id,
      [t('User ID')]: invoice.user_id,
      [t('Title type')]: t(
        invoice.buyer_type === 'company' ? 'Unit' : 'Individual'
      ),
      [t('Invoice title')]: invoice.title,
      [t('Tax number')]: invoice.tax_number,
      [t('Email')]: invoice.email,
      [t('Top-up orders')]: (invoice.orders || [])
        .map((order) => order.topup.trade_no)
        .join(', '),
      [t('Amount')]: invoice.amount,
      [t('Submitted at')]: invoice.create_time
        ? new Date(invoice.create_time * 1000).toLocaleString()
        : '',
    }))
}

export async function exportProcessingInvoices(
  invoices: Invoice[],
  t: Translate
) {
  const rows = buildProcessingInvoiceExportRows(invoices, t)
  if (rows.length === 0) return false

  const XLSX = await import('xlsx')
  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 28 },
    { wch: 24 },
    { wch: 32 },
    { wch: 42 },
    { wch: 14 },
    { wch: 22 },
  ]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoices')
  const date = new Date().toISOString().slice(0, 10)
  const itemSuffix = invoices.length === 1 ? `-${invoices[0].id}` : ''
  XLSX.writeFile(workbook, `processing-invoices${itemSuffix}-${date}.xlsx`)
  return true
}
