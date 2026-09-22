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
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { WalletTransactionsCard } from '../wallet-transactions-card'

vi.mock('../../hooks/use-wallet-transactions', () => ({
  useWalletTransactions: () => ({
    data: {
      items: [
        {
          id: 'transaction-1',
          source: 'online_topup',
          amount: 5000000,
          money: 10,
          trade_no: 'ORDER-123',
          payment_method: 'wechat',
          status: 'success',
          create_time: 1757894400,
        },
        {
          id: 'affiliate-2',
          source: 'affiliate_reward',
          amount: 300000,
          status: 'success',
          create_time: 1757894500,
        },
      ],
      total: 2,
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}))

describe('wallet balance history', () => {
  test('does not show order number, payment method, or paid amount', () => {
    const { container } = render(<WalletTransactionsCard />)

    expect(screen.getByText('Online top-up')).toBeInTheDocument()
    expect(screen.getByText('Referral reward')).toBeInTheDocument()
    expect(
      container.querySelector('.lucide-circle-dollar-sign')
    ).toBeInTheDocument()
    expect(screen.queryByText('Success')).not.toBeInTheDocument()
    expect(screen.queryByText(/ORDER-123/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Payment Method/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Payment:/)).not.toBeInTheDocument()
  })
})
