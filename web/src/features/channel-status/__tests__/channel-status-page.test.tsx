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

vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: (iconName: string) => (
    <span data-testid='lobe-icon'>{iconName}</span>
  ),
}))

const emptyResponse = {
  success: true,
  data: { items: [] },
}

const populatedResponse: Awaited<ReturnType<typeof getChannelStatus>> = {
  success: true,
  data: {
    degraded_latency_ms: 12000,
    notices: [
      {
        channel_type: 1,
        level: 'warning',
        content: 'OpenAI maintenance is in progress.',
        enabled: true,
      },
      {
        channel_type: 14,
        level: 'error',
        content: 'Anthropic requests are currently unavailable.',
        enabled: true,
      },
    ],
    items: [
      {
        channel_id: 1,
        channel_name: 'plus',
        channel_type: 1,
        provider: 'OpenAI',
        group: 'default',
        group_ratios: { default: 1.25 },
        model_name: 'gpt-5.6-sol',
        models: ['gpt-5.6-sol', 'gpt-4.1'],
        health: 'healthy' as const,
        latency_ms: 898,
        availability_7d: 80,
        availability_15d: 70,
        availability_30d: 60,
        availability_7d_samples: 10,
        availability_15d_samples: 20,
        availability_30d_samples: 30,
        avg_latency_7d_ms: 120,
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
        channel_id: 2,
        channel_name: 'Pro',
        channel_type: 14,
        provider: 'Anthropic',
        group: 'vip',
        group_ratios: { vip: 2 },
        model_name: 'claude-sonnet',
        models: ['claude-sonnet', 'claude-opus'],
        health: 'warning' as const,
        latency_ms: 12000,
        records: [
          {
            id: 3,
            model_name: 'claude-sonnet',
            success: false,
            latency_ms: 12000,
            tested_at: 1,
          },
          {
            id: 4,
            model_name: 'claude-sonnet',
            success: true,
            latency_ms: 12000,
            tested_at: 2,
          },
          {
            id: 5,
            model_name: 'claude-sonnet',
            success: true,
            latency_ms: 12000,
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

const responseWithMediaModels: Awaited<ReturnType<typeof getChannelStatus>> = {
  success: true,
  data: {
    items: [
      populatedResponse.data.items[0],
      {
        ...populatedResponse.data.items[1],
        channel_id: 3,
        channel_name: 'image-channel',
        group: 'image',
        model_name: 'gpt-image-1',
      },
      {
        ...populatedResponse.data.items[1],
        channel_id: 4,
        channel_name: 'video-channel',
        group: 'video',
        model_name: 'sora-2',
      },
      {
        ...populatedResponse.data.items[0],
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

  test('shows the time until the next automatic refresh', async () => {
    vi.useFakeTimers()
    vi.mocked(getChannelStatus).mockResolvedValue(populatedResponse)

    renderPage()

    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('Refreshes in 60s')).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(screen.getByText('Refreshes in 59s')).toBeInTheDocument()
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

    expect((await screen.findAllByText('legacy-model')).length).toBeGreaterThan(
      0
    )
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    const placeholders = screen.getAllByTestId('test-record')
    expect(placeholders).toHaveLength(60)
    for (const placeholder of placeholders) {
      expect(placeholder).toHaveAttribute('data-status', 'empty')
      expect(placeholder).toHaveClass('bg-muted')
    }
    expect(
      placeholders.some((placeholder) =>
        ['success', 'degraded', 'failure'].includes(
          placeholder.dataset.status ?? ''
        )
      )
    ).toBe(false)
  })

  test('renders platform groups, status, ratio, latency, and test history', async () => {
    vi.mocked(getChannelStatus).mockResolvedValue(populatedResponse)

    renderPage()

    expect(await screen.findByText('gpt-5.6-sol')).toBeInTheDocument()
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.getByText('Healthy')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('898 ms')).toBeInTheDocument()
    expect(screen.getByText('12000 ms')).toBeInTheDocument()
    expect(screen.getByText('x1.25')).toBeInTheDocument()
    expect(screen.getByText('x2')).toBeInTheDocument()
    expect(screen.getAllByText('Conversation latency').length).toBeGreaterThan(
      0
    )
    expect(screen.queryByText('Latency')).toBeNull()
    expect(screen.queryByText('Availability')).toBeNull()

    const notices = screen.getAllByTestId('channel-status-notice')
    expect(notices).toHaveLength(2)
    expect(
      notices.find((notice) => notice.dataset.level === 'warning')
    ).toHaveTextContent('OpenAI maintenance is in progress.')
    expect(
      notices.find((notice) => notice.dataset.level === 'error')
    ).toHaveTextContent('Anthropic requests are currently unavailable.')

    const cards = screen.getAllByTestId('channel-status-card')
    expect(cards).toHaveLength(2)
    const openAiCard = cards.find((card) => card.textContent?.includes('x1.25'))
    const anthropicCard = cards.find((card) => card.textContent?.includes('x2'))
    expect(openAiCard).toBeDefined()
    expect(anthropicCard).toBeDefined()
    if (!openAiCard || !anthropicCard) {
      throw new Error('Expected OpenAI and Anthropic channel status rows')
    }
    expect(within(openAiCard).getByLabelText('Last 60 tests')).toHaveClass(
      'h-2.5',
      'items-stretch'
    )
    expect(within(openAiCard).getAllByTestId('test-record')).toHaveLength(60)
    expect(within(openAiCard).getByLabelText('700 ms')).toBeInTheDocument()
    expect(within(openAiCard).getByLabelText('898 ms')).toBeInTheDocument()
    expect(
      within(openAiCard)
        .getAllByTestId('test-record')
        .filter((record) => record.dataset.status === 'success')
    ).toHaveLength(2)
    expect(
      within(anthropicCard)
        .getAllByTestId('test-record')
        .filter((record) => record.dataset.status === 'failure')
    ).toHaveLength(1)
    const degradedRecords = within(anthropicCard)
      .getAllByTestId('test-record')
      .filter((record) => record.dataset.status === 'degraded')
    expect(degradedRecords).toHaveLength(2)
    for (const record of degradedRecords) {
      expect(record).toHaveClass('bg-warning')
    }
    expect(within(openAiCard).getAllByTestId('test-record')[0]).toHaveClass(
      'rounded-l-full'
    )
    expect(within(openAiCard).getAllByTestId('test-record')[59]).toHaveClass(
      'rounded-r-full'
    )
  })

  test('shows channel names in status rows', async () => {
    vi.mocked(getChannelStatus).mockResolvedValue(populatedResponse)

    renderPage()

    expect(await screen.findAllByText('Channel / Model')).toHaveLength(2)
    expect(screen.getByText('plus')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.queryByText('default')).toBeNull()
    expect(screen.queryByText('vip')).toBeNull()
  })

  test('shows the distinct supported-model list for each status group row', async () => {
    vi.mocked(getChannelStatus).mockResolvedValue({
      success: true,
      data: {
        items: [
          populatedResponse.data.items[0],
          {
            ...populatedResponse.data.items[0],
            channel_id: 3,
            channel_name: 'second-openai-channel',
            group: 'vip',
            models: ['gpt-4.1', 'o3', 'o4-mini'],
          },
        ],
      },
    })
    const user = userEvent.setup()
    const clipboard = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()

    renderPage()

    const defaultGroupTrigger = await screen.findByRole('button', {
      name: 'Supported models (2)',
    })
    await user.click(defaultGroupTrigger)

    const defaultGroupModels = screen.getByRole('dialog', {
      name: 'Supported models (2)',
    })
    expect(within(defaultGroupModels).getByText('gpt-4.1')).toBeInTheDocument()
    expect(
      within(defaultGroupModels).getByText('gpt-5.6-sol')
    ).toBeInTheDocument()
    expect(within(defaultGroupModels).queryByText('o3')).toBeNull()
    expect(
      within(defaultGroupModels).getByTestId('model-list-scroll-area')
    ).toHaveClass('max-h-64', 'overflow-y-auto')
    await user.click(
      within(defaultGroupModels).getByRole('button', {
        name: 'Copy model name: gpt-4.1',
      })
    )
    expect(clipboard).toHaveBeenLastCalledWith('gpt-4.1')
    await user.click(
      within(defaultGroupModels).getByRole('button', {
        name: 'Copy model names',
      })
    )
    expect(clipboard).toHaveBeenLastCalledWith('gpt-4.1\ngpt-5.6-sol')

    await user.click(defaultGroupTrigger)
    await user.click(
      screen.getByRole('button', { name: 'Supported models (3)' })
    )

    const vipGroupModels = screen.getByRole('dialog', {
      name: 'Supported models (3)',
    })
    expect(within(vipGroupModels).getByText('gpt-4.1')).toBeInTheDocument()
    expect(within(vipGroupModels).getByText('o3')).toBeInTheDocument()
    expect(within(vipGroupModels).getByText('o4-mini')).toBeInTheDocument()
    expect(within(vipGroupModels).queryByText('gpt-5.6-sol')).toBeNull()
    clipboard.mockRestore()
  })

  test('orders major platforms as OpenAI, Claude, and DeepSeek before remaining providers', async () => {
    const baseRow = populatedResponse.data.items[0]
    vi.mocked(getChannelStatus).mockResolvedValue({
      success: true,
      data: {
        items: [
          { ...baseRow, channel_id: 10, provider: 'Zulu' },
          { ...baseRow, channel_id: 11, provider: 'DeepSeek' },
          { ...baseRow, channel_id: 12, provider: 'Anthropic' },
          { ...baseRow, channel_id: 13, provider: 'OpenAI' },
          { ...baseRow, channel_id: 14, provider: 'Alpha' },
        ],
      },
    })

    renderPage()

    await screen.findByText('Claude')
    expect(
      screen
        .getAllByTestId('channel-status-platform')
        .map(
          (platform) =>
            within(platform).getByRole('heading', { level: 2 }).textContent
        )
    ).toEqual(['OpenAI', 'Claude', 'DeepSeek', 'Alpha', 'Zulu'])
  })

  test('orders rows in each platform by the lowest group ratio and puts missing ratios last', async () => {
    const baseRow = populatedResponse.data.items[0]
    vi.mocked(getChannelStatus).mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            ...baseRow,
            channel_id: 10,
            channel_name: 'ratio-two',
            group: 'vip',
            group_ratios: { vip: 2 },
          },
          {
            ...baseRow,
            channel_id: 11,
            channel_name: 'ratio-half',
            group: 'discount',
            group_ratios: { discount: 0.5 },
          },
          {
            ...baseRow,
            channel_id: 12,
            channel_name: 'ratio-one',
            group: 'default,vip',
            group_ratios: { default: 1, vip: 3 },
          },
          {
            ...baseRow,
            channel_id: 13,
            channel_name: 'ratio-missing',
            group: 'legacy',
            group_ratios: {},
          },
        ],
      },
    })

    renderPage()

    const platform = (
      await screen.findByRole('heading', {
        name: 'OpenAI',
      })
    ).closest('section')
    expect(platform).not.toBeNull()
    if (!platform) throw new Error('Expected OpenAI platform group')
    const rows = within(platform).getAllByTestId('channel-status-card')
    expect(rows).toHaveLength(4)
    expect(rows[0]).toHaveTextContent('ratio-half')
    expect(rows[1]).toHaveTextContent('ratio-one')
    expect(rows[2]).toHaveTextContent('ratio-two')
    expect(rows[3]).toHaveTextContent('ratio-missing')
  })

  test('renders cards when the interface uses the internal zhCN code', async () => {
    await i18next.changeLanguage('zhCN')
    vi.mocked(getChannelStatus).mockResolvedValue(populatedResponse)

    renderPage()

    expect(await screen.findByText('gpt-5.6-sol')).toBeInTheDocument()
    expect(screen.getAllByTestId('channel-status-card')).toHaveLength(2)
  })

  test('hides image and video groups while preserving model text', async () => {
    vi.mocked(getChannelStatus).mockResolvedValue(responseWithMediaModels)

    renderPage()

    expect(await screen.findByText('gpt-5.6-sol')).toBeInTheDocument()
    expect(screen.queryByText('image-channel')).toBeNull()
    expect(screen.queryByText('video-channel')).toBeNull()
    expect(screen.queryByText('regular-group-image-model-channel')).toBeNull()
    expect(screen.queryByText('gpt-image-2')).toBeNull()
    expect(screen.getAllByTestId('channel-status-card')).toHaveLength(1)
  })

  test('hides availability period controls and keeps channel details click disabled', async () => {
    vi.mocked(getChannelStatus).mockResolvedValue(populatedResponse)
    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByText('80.0%')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '15 days' })).toBeNull()

    const openAiCard = screen
      .getAllByTestId('channel-status-card')
      .find((card) => card.textContent?.includes('x1.25'))
    expect(openAiCard).toBeDefined()
    if (!openAiCard) throw new Error('Expected OpenAI channel status row')
    await user.click(openAiCard)
    expect(screen.queryByText('Latest status')).toBeNull()
  })
})
