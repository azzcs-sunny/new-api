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
import { describe, expect, test } from 'vitest'

import { OrderRow } from '../index'
import type { InvoiceOrder } from '../types'

const orders: InvoiceOrder[] = [
  {
    topup_id: 1,
    trade_no: 'ORDER-001',
    amount: 100,
    money: 100,
    create_time: 1,
  },
  {
    topup_id: 2,
    trade_no: 'ORDER-002',
    amount: 200,
    money: 200,
    create_time: 2,
  },
]

function SelectionFixture() {
  const [selected, setSelected] = useState<number[]>([])
  return (
    <>
      {orders.map((order) => (
        <OrderRow
          key={order.topup_id}
          order={order}
          checked={selected.includes(order.topup_id)}
          disabled={false}
          onChange={(checked) =>
            setSelected((current) => {
              if (!checked) {
                return current.filter((id) => id !== order.topup_id)
              }
              if (current.includes(order.topup_id)) return current
              return [...current, order.topup_id]
            })
          }
        />
      ))}
    </>
  )
}

describe('invoice order selection', () => {
  test('clicking one order selects only that order', async () => {
    const user = userEvent.setup()
    render(<SelectionFixture />)

    await user.click(screen.getByRole('checkbox', { name: 'ORDER-001' }))

    expect(screen.getByRole('checkbox', { name: 'ORDER-001' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByRole('checkbox', { name: 'ORDER-002' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })
})
