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
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import {
  getAffiliateRewardAdminDetails,
  getAffiliateRewardDetails,
} from '@/features/wallet/api'

import { RewardDetailsDrawer } from '../components/reward-details-drawer'

vi.mock('@/features/wallet/api', () => ({
  getAffiliateRewardDetails: vi.fn(),
  getAffiliateRewardAdminDetails: vi.fn(),
}))

function renderDrawer(admin = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <RewardDetailsDrawer
        open
        admin={admin}
        inviterId={admin ? 7 : undefined}
        inviteeId={42}
        onOpenChange={() => undefined}
      />
    </QueryClientProvider>
  )
}

describe('affiliate earning details privacy', () => {
  test('inviter view omits order and credited amount fields', async () => {
    vi.mocked(getAffiliateRewardDetails).mockResolvedValue({
      success: true,
      data: {
        page: 1,
        page_size: 10,
        total: 1,
        items: [
          {
            sequence: 1,
            reward_quota: 50,
            ratio: 0.1,
            status: 'frozen',
            created_at: 1788019200,
          },
        ],
      },
    })

    renderDrawer()

    await waitFor(() =>
      expect(getAffiliateRewardDetails).toHaveBeenCalledWith(42, 1, 10)
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(await screen.findByText('Amount Earned')).toBeInTheDocument()
    expect(screen.queryByText('Order Number')).toBeNull()
    expect(screen.queryByText('Credited Amount')).toBeNull()
    expect(getAffiliateRewardAdminDetails).not.toHaveBeenCalled()
  })

  test('administrator view includes order-level fields', async () => {
    vi.mocked(getAffiliateRewardAdminDetails).mockResolvedValue({
      success: true,
      data: {
        page: 1,
        page_size: 10,
        total: 1,
        items: [
          {
            top_up_id: 9,
            trade_no: 'admin-visible-order',
            base_quota: 500,
            sequence: 1,
            reward_quota: 50,
            ratio: 0.1,
            status: 'granted',
            created_at: 1788019200,
          },
        ],
      },
    })

    renderDrawer(true)

    await waitFor(() =>
      expect(getAffiliateRewardAdminDetails).toHaveBeenCalledWith(7, 42, 1, 10)
    )
    expect(await screen.findByText('Order Number')).toBeInTheDocument()
    expect(screen.getByText('Credited Amount')).toBeInTheDocument()
    expect(screen.getByText('admin-visible-order')).toBeInTheDocument()
  })
})
