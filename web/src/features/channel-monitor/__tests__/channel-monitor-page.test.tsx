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
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { formatTimestampToDate } from '@/lib/format'

import {
  clearChannelTestData,
  getAllChannelStatus,
  updateChannelActiveTestEnabled,
  updateChannelStatusHealthyThreshold,
  updateChannelStatusVisibility,
} from '../api'
import { ChannelMonitor } from '../index'

vi.mock('../api', () => ({
  clearChannelTestData: vi.fn(),
  getAllChannelStatus: vi.fn(),
  updateChannelActiveTestEnabled: vi.fn(),
  updateChannelStatusHealthyThreshold: vi.fn(),
  updateChannelStatusVisibility: vi.fn(),
}))

const response: Awaited<ReturnType<typeof getAllChannelStatus>> = {
  success: true,
  data: {
    degraded_latency_ms: 12000,
    items: [
      {
        channel_id: 1,
        channel_name: 'enabled-channel',
        channel_type: 1,
        provider: 'OpenAI',
        channel_status: 1,
        group: 'default',
        group_ratios: { default: 1 },
        model_name: 'enabled-model',
        health: 'healthy',
        latency_ms: 100,
        latest_checked_at: 1750000000000,
        active_test_enabled: true,
        visible: true,
        records: [],
      },
      {
        channel_id: 2,
        channel_name: 'disabled-channel',
        channel_type: 14,
        provider: 'Anthropic',
        channel_status: 2,
        group: 'vip,internal',
        group_ratios: { vip: 1.5 },
        model_name: 'disabled-model',
        health: 'unknown',
        latency_ms: 0,
        active_test_enabled: false,
        visible: false,
        records: [],
      },
      {
        channel_id: 3,
        channel_name: 'image-channel',
        channel_type: 1,
        provider: 'OpenAI',
        channel_status: 1,
        group: 'image',
        model_name: 'gpt-image-2',
        health: 'unknown',
        latency_ms: 0,
        active_test_enabled: true,
        visible: true,
        records: [],
      },
    ],
  },
}

let queryClient: QueryClient | undefined

function renderPage() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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
  vi.mocked(clearChannelTestData).mockReset()
  vi.mocked(updateChannelActiveTestEnabled).mockReset()
  vi.mocked(updateChannelStatusHealthyThreshold).mockReset()
  vi.mocked(updateChannelStatusVisibility).mockReset()
  await i18next.changeLanguage('en')
})

describe('channel monitor page', () => {
  test('lists every channel with type, status, groups, last test, and visibility', async () => {
    vi.mocked(getAllChannelStatus).mockResolvedValue(response)

    renderPage()

    expect(await screen.findByText('enabled-channel')).toBeInTheDocument()
    expect(screen.getByText('disabled-channel')).toBeInTheDocument()
    expect(screen.getByText('image-channel')).toBeInTheDocument()
    expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0)
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
    expect(screen.getAllByText('Enabled')).toHaveLength(2)
    expect(screen.getByText('Disabled')).toBeInTheDocument()
    expect(screen.getByText('default')).toBeInTheDocument()
    expect(screen.getByText('vip')).toBeInTheDocument()
    expect(screen.getByText('internal')).toBeInTheDocument()
    expect(
      screen.getByText(formatTimestampToDate(1750000000000, 'milliseconds'))
    ).toBeInTheDocument()
    expect(
      screen.getByRole('switch', {
        name: 'Include enabled-channel in active checks',
      })
    ).toBeChecked()
    expect(
      screen.getByRole('switch', {
        name: 'Include disabled-channel in active checks',
      })
    ).not.toBeChecked()
    expect(
      screen.getByRole('switch', {
        name: 'Show enabled-channel on channel status',
      })
    ).toBeChecked()
    expect(
      screen.getByRole('switch', {
        name: 'Show disabled-channel on channel status',
      })
    ).not.toBeChecked()
  })

  test('updates active-check inclusion from its table switch', async () => {
    vi.mocked(getAllChannelStatus).mockResolvedValue(response)
    vi.mocked(updateChannelActiveTestEnabled).mockResolvedValue({
      success: true,
      data: { active_test_enabled: false },
    })
    const user = userEvent.setup()

    renderPage()

    const activeTestSwitch = await screen.findByRole('switch', {
      name: 'Include enabled-channel in active checks',
    })
    await user.click(activeTestSwitch)

    await waitFor(() => {
      expect(updateChannelActiveTestEnabled).toHaveBeenCalledWith(1, false)
    })
    expect(activeTestSwitch).not.toBeChecked()
  })

  test('updates one channel visibility from its table switch', async () => {
    vi.mocked(getAllChannelStatus).mockResolvedValue(response)
    vi.mocked(updateChannelStatusVisibility).mockResolvedValue({
      success: true,
      data: { visible: false },
    })
    const user = userEvent.setup()

    renderPage()

    const visibilitySwitch = await screen.findByRole('switch', {
      name: 'Show enabled-channel on channel status',
    })
    await user.click(visibilitySwitch)

    await waitFor(() => {
      expect(updateChannelStatusVisibility).toHaveBeenCalledWith(1, false)
    })
    expect(visibilitySwitch).not.toBeChecked()
  })

  test('confirms before clearing one channel active-check history', async () => {
    vi.mocked(getAllChannelStatus).mockResolvedValue({
      ...response,
      data: {
        ...response.data,
        items: response.data.items.map((item) =>
          item.channel_id === 1
            ? {
                ...item,
                records: [
                  {
                    id: 1,
                    model_name: 'enabled-model',
                    success: true,
                    latency_ms: 100,
                    tested_at: 1750000000000,
                  },
                ],
              }
            : item
        ),
      },
    })
    vi.mocked(clearChannelTestData).mockResolvedValue({
      success: true,
      data: { deleted_count: 1 },
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(
      await screen.findByRole('button', {
        name: 'Clear test data for enabled-channel',
      })
    )
    expect(clearChannelTestData).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Clear test data?'
    )

    await user.click(screen.getByRole('button', { name: 'Clear' }))

    await waitFor(() => {
      expect(clearChannelTestData).toHaveBeenCalledWith(1)
    })
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  test('loads and saves the healthy latency threshold in seconds', async () => {
    vi.mocked(getAllChannelStatus).mockResolvedValue(response)
    vi.mocked(updateChannelStatusHealthyThreshold).mockResolvedValue({
      success: true,
      data: { healthy_seconds: 18, degraded_latency_ms: 18000 },
    })
    const user = userEvent.setup()

    renderPage()

    const input = await screen.findByRole('spinbutton', {
      name: 'Healthy below (seconds)',
    })
    expect(input).toHaveValue(12)
    await user.clear(input)
    await user.type(input, '18')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateChannelStatusHealthyThreshold).toHaveBeenCalledWith(18)
    })
    expect(input).toHaveValue(18)
  })

  test('rejects an out-of-range healthy threshold before submission', async () => {
    vi.mocked(getAllChannelStatus).mockResolvedValue(response)
    const user = userEvent.setup()

    renderPage()

    const input = await screen.findByRole('spinbutton', {
      name: 'Healthy below (seconds)',
    })
    await user.clear(input)
    await user.type(input, '301')

    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(updateChannelStatusHealthyThreshold).not.toHaveBeenCalled()
  })

  test('keeps all channel rows in one table', async () => {
    vi.mocked(getAllChannelStatus).mockResolvedValue(response)

    renderPage()

    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(4)
  })
})
