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

import { getAffiliateRewards } from '@/features/wallet/api'
import { useAffiliate } from '@/features/wallet/hooks/use-affiliate'
import { useTopupInfo } from '@/features/wallet/hooks/use-topup-info'
import { getSelf } from '@/lib/api'

import { Affiliate } from '..'

vi.mock('@/features/wallet/api', () => ({
  getAffiliateRewards: vi.fn(),
}))
vi.mock('@/features/wallet/hooks/use-affiliate', () => ({
  useAffiliate: vi.fn(),
}))
vi.mock('@/features/wallet/hooks/use-topup-info', () => ({
  useTopupInfo: vi.fn(),
}))
vi.mock('@/lib/api', () => ({
  getSelf: vi.fn(),
}))
vi.mock('@/features/wallet/components/dialogs/transfer-dialog', () => ({
  TransferDialog: () => null,
}))
vi.mock('@/features/affiliate/components/reward-details-drawer', () => ({
  RewardDetailsDrawer: () => null,
}))

describe('affiliate page layout', () => {
  test('summary and reward table both use the full content width', async () => {
    vi.mocked(useAffiliate).mockReturnValue({
      affiliateCode: 'test-code',
      affiliateLink: 'https://example.com/register?aff=test-code',
      loading: false,
      transferring: false,
      copyAffiliateLink: vi.fn(),
      transferQuota: vi.fn().mockResolvedValue(true),
      refetch: vi.fn().mockResolvedValue(undefined),
    })
    vi.mocked(useTopupInfo).mockReturnValue({
      topupInfo: null,
      presetAmounts: [],
      loading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    })
    vi.mocked(getSelf).mockResolvedValue({
      success: true,
      data: {
        id: 1,
        username: 'inviter',
        quota: 0,
        used_quota: 0,
        request_count: 0,
        aff_quota: 0,
        aff_history_quota: 0,
        aff_count: 0,
        group: 'default',
      },
    })
    vi.mocked(getAffiliateRewards).mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            invitee_id: 42,
            joined_at: 1788019200,
            top_up_count: 1,
            reward_quota: 50,
            frozen_quota: 0,
            last_reward_at: 1788019200,
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
        frozen_quota: 0,
        ratio: 0.1,
      },
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <Affiliate />
      </QueryClientProvider>
    )

    const table = await screen.findByRole('table')
    expect(table.closest('.max-w-7xl')).toBeNull()
    const summary = screen
      .getByText('Share your referral link')
      .closest('[data-slot="card"]')
    expect(summary).toHaveClass('w-full')
    expect(summary).not.toHaveClass('max-w-7xl')

    const inviteCount = screen.getByText('Invites').parentElement
    await waitFor(() => expect(inviteCount).toHaveTextContent('1'))
  })
})
