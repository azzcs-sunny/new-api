/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'

import { RejectInvoiceDialog } from '../index'

function RejectDialogFixture(props: { onConfirm: (id: number) => void }) {
  const [reason, setReason] = useState('')
  return (
    <RejectInvoiceDialog
      invoiceId={12}
      reason={reason}
      busy={false}
      onReasonChange={setReason}
      onClose={vi.fn()}
      onConfirm={props.onConfirm}
    />
  )
}

describe('reject invoice dialog', () => {
  test('requires a reason before confirming from the modal', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<RejectDialogFixture onConfirm={onConfirm} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const confirmButton = screen.getByRole('button', {
      name: 'Confirm rejection',
    })
    expect(confirmButton).toBeDisabled()

    await user.type(screen.getByLabelText('Rejection reason'), 'Wrong title')
    expect(confirmButton).toBeEnabled()
    await user.click(confirmButton)

    expect(onConfirm).toHaveBeenCalledWith(12)
  })
})
