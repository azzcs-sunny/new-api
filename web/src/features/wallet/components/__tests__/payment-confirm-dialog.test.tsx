/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { PaymentConfirmDialog } from '../dialogs/payment-confirm-dialog'

const paymentMethod = { name: 'Alipay', type: 'alipay' }

describe('payment confirmation service fee', () => {
  test('shows the fee percentage and amount when the top-up rate includes a fee', () => {
    render(
      <PaymentConfirmDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        topupAmount={100}
        paymentAmount={103}
        paymentMethod={paymentMethod}
        calculating={false}
        processing={false}
        topupGroupRatio={1.03}
      />
    )

    const feeLabel = screen.getByText('Service fee')
    const feeRow = feeLabel.parentElement?.parentElement
    expect(feeRow).toBeDefined()
    if (!feeRow) throw new Error('Expected service fee row')
    expect(within(feeRow).getByText('3%')).toBeInTheDocument()
    expect(within(feeRow).getByText('3')).toBeInTheDocument()
    expect(screen.getByText('103')).toBeInTheDocument()
  })

  test('hides the fee row when the top-up rate has no surcharge', () => {
    render(
      <PaymentConfirmDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        topupAmount={100}
        paymentAmount={100}
        paymentMethod={paymentMethod}
        calculating={false}
        processing={false}
        topupGroupRatio={1}
      />
    )

    expect(screen.queryByText('Service fee')).not.toBeInTheDocument()
  })
})
