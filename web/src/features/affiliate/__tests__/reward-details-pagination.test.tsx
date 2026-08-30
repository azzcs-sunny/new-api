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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { getAffiliateRewardDetails } from '@/features/wallet/api'

import { RewardDetailsDrawer } from '../components/reward-details-drawer'

vi.mock('@/features/wallet/api', () => ({
  getAffiliateRewardDetails: vi.fn(),
  getAffiliateRewardAdminDetails: vi.fn(),
}))

describe('affiliate earning details pagination', () => {
  test('table fills the drawer and requests the selected server page', async () => {
    vi.mocked(getAffiliateRewardDetails).mockResolvedValue({
      success: true,
      data: {
        page: 1,
        page_size: 10,
        total: 11,
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

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <RewardDetailsDrawer
          open
          inviteeId={42}
          onOpenChange={() => undefined}
        />
      </QueryClientProvider>
    )

    const table = await screen.findByRole('table')
    expect(table.closest('div.rounded-lg.border')).toHaveClass(
      'w-full',
      'min-h-0',
      'flex-1'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }))
    await waitFor(() =>
      expect(getAffiliateRewardDetails).toHaveBeenLastCalledWith(42, 2, 10)
    )
  })
})
