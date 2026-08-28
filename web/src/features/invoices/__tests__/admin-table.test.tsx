/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { AdminInvoiceTable } from '../index'
import type { Invoice } from '../types'

function createInvoice(id: number, status: string): Invoice {
  return {
    id,
    user_id: id,
    invoice_type: 'normal',
    buyer_type: 'individual',
    title: `Invoice ${id}`,
    tax_number: '',
    email: `user${id}@example.com`,
    phone: '',
    address: '',
    bank_name: '',
    bank_account: '',
    amount: 10,
    status,
    reject_reason: '',
    invoice_number: '',
    file_url: '',
    create_time: 1_700_000_000,
    issue_time: 0,
  }
}

describe('admin invoice table', () => {
  test('allows selecting and exporting only processing invoices', async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    const onExport = vi.fn()

    render(
      <AdminInvoiceTable
        invoices={[createInvoice(1, 'processing'), createInvoice(2, 'pending')]}
        selectedIds={[]}
        busy={false}
        exporting={false}
        onSelectionChange={onSelectionChange}
        onExport={onExport}
        onProcess={vi.fn()}
        onIssue={vi.fn()}
        onReject={vi.fn()}
      />
    )

    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    const rowCheckboxes = screen.getAllByRole('checkbox', {
      name: 'Select row',
    })
    expect(rowCheckboxes[0]).not.toBeDisabled()
    expect(rowCheckboxes[1]).toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.getByRole('button', { name: 'Export order' })
    ).toBeInTheDocument()
    expect(screen.getAllByText('Reject')).toHaveLength(2)
    expect(screen.getByText('Actions').closest('th')).toHaveClass(
      'sticky',
      'right-0',
      'z-30'
    )

    await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0])
    expect(onSelectionChange).toHaveBeenCalledWith([1])

    await user.click(screen.getByRole('button', { name: 'Export order' }))
    expect(onExport).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, status: 'processing' }),
    ])
  })
})
