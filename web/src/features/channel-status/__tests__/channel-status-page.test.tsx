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
  data: { items: [] },
}

const populatedResponse = {
  success: true,
  data: {
    items: [
      {
        group: 'default',
        model_name: 'gpt-5.6-sol',
        health: 'healthy' as const,
        latency_ms: 898,
        records: [
          {
            id: 1,
            model_name: 'gpt-5.6-sol',
            success: true,
            latency_ms: 700,
            tested_at: 1,
          },
          {
            id: 2,
            model_name: 'gpt-5.6-sol',
            success: true,
            latency_ms: 898,
            tested_at: 2,
          },
        ],
      },
      {
        group: 'vip',
        model_name: 'claude-sonnet',
        health: 'warning' as const,
        latency_ms: 9000,
        records: [
          {
            id: 3,
            model_name: 'claude-sonnet',
            success: false,
            latency_ms: 9000,
            tested_at: 1,
          },
          {
            id: 4,
            model_name: 'claude-sonnet',
            success: true,
            latency_ms: 9000,
            tested_at: 2,
          },
          {
            id: 5,
            model_name: 'claude-sonnet',
            success: true,
            latency_ms: 9000,
            tested_at: 3,
          },
        ],
      },
    ],
  },
}

const responseWithoutTestRecords = {
  success: true,
  data: {
    items: [
      {
        group: 'legacy',
        model_name: 'legacy-model',
        latency_ms: 0,
      },
    ],
  },
} as unknown as Awaited<ReturnType<typeof getChannelStatus>>

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
  test('shows an empty state when no channel tests exist', async () => {
    vi.mocked(getChannelStatus).mockResolvedValue(emptyResponse)

    renderPage()

    expect(
      await screen.findByText('No channel test data is available yet.')
    ).toBeInTheDocument()
  })

  test('refreshes the test status data every minute', async () => {
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

  test('distinguishes a failed request from an empty test history', async () => {
    vi.mocked(getChannelStatus).mockRejectedValue(new Error('offline'))

    renderPage()

    expect(await screen.findByText('Failed to load')).toBeInTheDocument()
    expect(screen.getByText('Please try again later.')).toBeInTheDocument()
    expect(
      screen.queryByText('No channel test data is available yet.')
    ).toBeNull()
  })

  test('handles cached rows from before test records were added', async () => {
    vi.mocked(getChannelStatus).mockResolvedValue(responseWithoutTestRecords)

    renderPage()

    expect(await screen.findByText('legacy-model')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getAllByTestId('test-record')).toHaveLength(60)
  })

  test('renders only group, model, status, latency, and test history', async () => {
    vi.mocked(getChannelStatus).mockResolvedValue(populatedResponse)

    renderPage()

    expect(await screen.findByText('gpt-5.6-sol')).toBeInTheDocument()
    expect(screen.getByText('Healthy')).toBeInTheDocument()
    expect(screen.getByText('vip')).toBeInTheDocument()
    expect(screen.getAllByText('Model')).toHaveLength(2)
    expect(screen.getAllByText('Latency')).toHaveLength(2)
    expect(screen.getByText('898 ms')).toBeInTheDocument()
    expect(screen.getByText('9000 ms')).toBeInTheDocument()
    expect(screen.queryByText('OpenAI')).toBeNull()
    expect(screen.queryByText('Conversation latency')).toBeNull()
    expect(screen.queryByText('Availability')).toBeNull()

    const cards = screen.getAllByTestId('channel-status-card')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getAllByTestId('test-record')).toHaveLength(60)
    expect(
      within(cards[0])
        .getAllByTestId('test-record')
        .filter((record) => record.dataset.status === 'success')
    ).toHaveLength(2)
    expect(
      within(cards[1])
        .getAllByTestId('test-record')
        .filter((record) => record.dataset.status === 'failure')
    ).toHaveLength(1)
  })

  test('renders cards when the interface uses the internal zhCN code', async () => {
    await i18next.changeLanguage('zhCN')
    vi.mocked(getChannelStatus).mockResolvedValue(populatedResponse)

    renderPage()

    expect(await screen.findByText('gpt-5.6-sol')).toBeInTheDocument()
    expect(screen.getAllByTestId('channel-status-card')).toHaveLength(2)
  })
})
