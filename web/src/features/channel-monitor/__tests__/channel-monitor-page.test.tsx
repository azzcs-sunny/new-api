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
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { getAllChannelStatus } from '../api'
import { ChannelMonitor } from '../index'

vi.mock('../api', () => ({
  getAllChannelStatus: vi.fn(),
}))

const response = {
  success: true,
  data: {
    items: [
      {
        channel_id: 1,
        channel_name: 'enabled-channel',
        channel_status: 1,
        group: 'default',
        group_ratios: { default: 1 },
        model_name: 'enabled-model',
        health: 'healthy' as const,
        latency_ms: 100,
        availability_7d: 80,
        availability_15d: 70,
        availability_30d: 60,
        availability_7d_samples: 10,
        availability_15d_samples: 20,
        availability_30d_samples: 30,
        avg_latency_7d_ms: 120,
        records: [],
      },
      {
        channel_id: 2,
        channel_name: 'disabled-channel',
        channel_status: 2,
        group: 'vip',
        group_ratios: { vip: 1.5 },
        model_name: 'disabled-model',
        health: 'unknown' as const,
        latency_ms: 0,
        records: [],
      },
    ],
  },
} as Awaited<ReturnType<typeof getAllChannelStatus>>

const responseWithMediaModels: Awaited<ReturnType<typeof getAllChannelStatus>> =
  {
    success: true,
    data: {
      items: [
        response.data.items[0],
        {
          ...response.data.items[1],
          channel_id: 3,
          channel_name: 'image-channel',
          group: 'image',
          model_name: 'imagen-4',
        },
        {
          ...response.data.items[1],
          channel_id: 4,
          channel_name: 'video-channel',
          group: 'video',
          model_name: 'kling-v2',
        },
        {
          ...response.data.items[0],
          channel_id: 5,
          channel_name: 'regular-group-image-model-channel',
          model_name: 'gpt-image-2',
        },
      ],
    },
  }

let queryClient: QueryClient | undefined

function renderPage() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ChannelMonitor />
    </QueryClientProvider>
  )
}

afterEach(async () => {
  cleanup()
  queryClient?.clear()
  queryClient = undefined
  vi.mocked(getAllChannelStatus).mockReset()
  await i18next.changeLanguage('en')
})

describe('channel monitor page', () => {
  test('hides image and video groups while preserving model text', async () => {
    vi.mocked(getAllChannelStatus).mockResolvedValue(responseWithMediaModels)

    renderPage()

    expect(await screen.findByText('enabled-channel')).toBeInTheDocument()
    expect(screen.queryByText('image-channel')).toBeNull()
    expect(screen.queryByText('video-channel')).toBeNull()
    expect(screen.queryByText('regular-group-image-model-channel')).toBeNull()
    expect(screen.queryByText('gpt-image-2')).toBeNull()
    expect(screen.getAllByTestId('channel-status-card')).toHaveLength(1)
  })

  test('filters cards by enabled and disabled channel status', async () => {
    vi.mocked(getAllChannelStatus).mockResolvedValue(response)
    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByText('enabled-channel')).toBeInTheDocument()
    expect(screen.getByText('disabled-channel')).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Channel monitoring status' })
    ).toHaveTextContent('All Status')

    await user.click(
      screen.getByRole('combobox', { name: 'Channel monitoring status' })
    )
    await user.click(await screen.findByRole('option', { name: 'Disabled' }))

    await waitFor(() => {
      expect(screen.queryByText('enabled-channel')).toBeNull()
    })
    expect(screen.getByText('disabled-channel')).toBeInTheDocument()

    await user.click(
      screen.getByRole('combobox', { name: 'Channel monitoring status' })
    )
    await user.click(await screen.findByRole('option', { name: 'Enabled' }))

    await waitFor(() => {
      expect(screen.queryByText('disabled-channel')).toBeNull()
    })
    expect(screen.getByText('enabled-channel')).toBeInTheDocument()
  })

  test('changes the card availability window and opens channel details', async () => {
    vi.mocked(getAllChannelStatus).mockResolvedValue(response)
    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByText('80.0%')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '30 days' }))
    expect(screen.getByText('60.0%')).toBeInTheDocument()

    await user.click(screen.getAllByTestId('channel-status-card')[0])
    expect(await screen.findByText('Latest status')).toBeInTheDocument()
    expect(screen.getAllByText('30-day availability').length).toBeGreaterThan(1)
    expect(screen.getByText('60.00%')).toBeInTheDocument()
  })
})
