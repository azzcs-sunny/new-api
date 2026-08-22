/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { getChannelStatus } from '../api'
import { ChannelStatus } from '../index'

vi.mock('../api', () => ({
  getChannelStatus: vi.fn(),
}))

const emptyResponse = {
  success: true,
  data: {
    hours: 168,
    bucket_seconds: 21600,
    from_ts: 0,
    through_ts: 0,
    truncated: false,
    summary: {
      avg_ttft_ms: 0,
      avg_latency_ms: 0,
      latest_latency_ms: 0,
      success_rate: 0,
      avg_tps: 0,
      health: 'unknown' as const,
      has_data: false,
    },
    series: [],
    items: [],
  },
}

const populatedResponse = {
  success: true,
  data: {
    ...emptyResponse.data,
    through_ts: 1787371200,
    summary: {
      avg_ttft_ms: 1764,
      avg_latency_ms: 2931,
      latest_latency_ms: 898,
      success_rate: 100,
      avg_tps: 40.27,
      health: 'healthy' as const,
      has_data: true,
    },
    series: [
      {
        ts: 1787371200,
        request_count: 80,
        success_count: 80,
        avg_ttft_ms: 1764,
        avg_latency_ms: 2931,
        success_rate: 100,
        avg_tps: 40.27,
        has_data: true,
      },
    ],
    items: [
      {
        channel_type: 1,
        provider: 'OpenAI',
        group: 'default',
        model_name: 'gpt-5.6-sol',
        ping_ms: 6,
        metrics: {
          avg_ttft_ms: 1764,
          avg_latency_ms: 2931,
          latest_latency_ms: 898,
          success_rate: 100,
          avg_tps: 40.27,
          health: 'healthy' as const,
          has_data: true,
        },
        series: [
          {
            ts: 1787371200,
            request_count: 80,
            success_count: 80,
            avg_ttft_ms: 1764,
            avg_latency_ms: 2931,
            success_rate: 100,
            avg_tps: 40.27,
            has_data: true,
          },
        ],
      },
      {
        channel_type: 14,
        provider: 'Anthropic',
        group: 'vip',
        model_name: 'claude-sonnet',
        ping_ms: 17,
        metrics: {
          avg_ttft_ms: 900,
          avg_latency_ms: 2100,
          latest_latency_ms: 1250,
          success_rate: 97,
          avg_tps: 35,
          health: 'warning' as const,
          has_data: true,
        },
        series: [
          {
            ts: 1787371200,
            request_count: 3,
            success_count: 2,
            avg_ttft_ms: 900,
            avg_latency_ms: 2100,
            success_rate: 97,
            avg_tps: 35,
            has_data: true,
          },
        ],
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
      <ChannelStatus />
    </QueryClientProvider>
  )
}

afterEach(async () => {
  vi.useRealTimers()
  queryClient?.clear()
  queryClient = undefined
  await i18next.changeLanguage('en')
})

describe('channel status page', () => {
  test('shows the empty state when the selected period has no samples', async () => {
    vi.mocked(getChannelStatus).mockResolvedValue(emptyResponse)

    renderPage()

    expect(
      await screen.findByText(
        'No channel status data is available for this period.'
      )
    ).toBeInTheDocument()
  })

  test('requests a new time window when the range tab changes', async () => {
    vi.mocked(getChannelStatus).mockResolvedValue(emptyResponse)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(getChannelStatus).toHaveBeenCalledWith(168))

    await user.click(screen.getByRole('tab', { name: '15 days' }))

    await waitFor(() => expect(getChannelStatus).toHaveBeenCalledWith(360))
  })

  test('exposes an accessible refresh command and refetches on click', async () => {
    vi.mocked(getChannelStatus).mockResolvedValue(emptyResponse)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(getChannelStatus).toHaveBeenCalledTimes(1))

    await user.click(
      screen.getByRole('button', { name: 'Refresh channel status' })
    )

    await waitFor(() => expect(getChannelStatus).toHaveBeenCalledTimes(2))
  })

  test('refetches when the visible countdown reaches zero', async () => {
    vi.useFakeTimers()
    vi.mocked(getChannelStatus).mockResolvedValue(populatedResponse)

    renderPage()
    await act(async () => {
      await Promise.resolve()
    })
    expect(getChannelStatus).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 1000)
    })

    expect(getChannelStatus).toHaveBeenCalledTimes(2)
  })

  test('distinguishes a failed request from a valid empty period', async () => {
    vi.mocked(getChannelStatus).mockRejectedValue(new Error('offline'))

    renderPage()

    expect(await screen.findByText('Failed to load')).toBeInTheDocument()
    expect(screen.getByText('Please try again later.')).toBeInTheDocument()
    expect(
      screen.queryByText('No channel status data is available for this period.')
    ).toBeNull()
  })

  test('renders the complete page after the first passive sample arrives', async () => {
    vi.mocked(getChannelStatus).mockResolvedValue(populatedResponse)

    renderPage()

    expect(await screen.findByText('gpt-5.6-sol')).toBeInTheDocument()
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Operational')).toBeInTheDocument()
    expect(screen.getByText('vip')).toBeInTheDocument()
    expect(screen.getAllByText('Conversation latency')).toHaveLength(2)
    expect(screen.getAllByText('Node PING')).toHaveLength(2)
    expect(screen.getByText('898 ms')).toBeInTheDocument()
    expect(screen.queryByText('2931 ms')).toBeNull()
    expect(screen.getByText('6 ms')).toBeInTheDocument()
    expect(screen.queryByText('First token')).toBeNull()
    expect(screen.queryByText('Throughput')).toBeNull()

    const cards = screen.getAllByTestId('channel-status-card')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByText('Operational')).toHaveClass(
      'text-success'
    )
    expect(within(cards[1]).getByText('Degraded')).toHaveClass('text-warning')
    expect(within(cards[0]).getAllByTestId('usage-record')).toHaveLength(60)
    expect(
      within(cards[0])
        .getAllByTestId('usage-record')
        .every((record) => record.dataset.status === 'success')
    ).toBe(true)
    expect(
      within(cards[1])
        .getAllByTestId('usage-record')
        .filter((record) => record.dataset.status === 'failure')
    ).toHaveLength(1)
  })

  test('renders timestamps when the interface uses the internal zhCN code', async () => {
    await i18next.changeLanguage('zhCN')
    vi.mocked(getChannelStatus).mockResolvedValue(populatedResponse)

    renderPage()

    expect(await screen.findByText('gpt-5.6-sol')).toBeInTheDocument()
    expect(screen.getAllByTestId('channel-status-card')).toHaveLength(2)
  })
})
