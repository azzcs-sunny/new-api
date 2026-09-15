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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { updateSystemOption } from '../../api'
import { ChannelStatusNoticesSection } from '../channel-status-notices-section'

vi.mock('../../api', () => ({
  updateSystemOption: vi.fn(),
}))

function renderSection(data = '[]') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ChannelStatusNoticesSection data={data} />
    </QueryClientProvider>
  )
}

describe('channel status notices section', () => {
  beforeEach(() => {
    vi.mocked(updateSystemOption).mockResolvedValue({
      success: true,
      message: '',
    })
  })

  test('adds one notice for an unused platform and saves the normalized list', async () => {
    const user = userEvent.setup()
    renderSection(
      JSON.stringify([
        {
          channel_type: 1,
          level: 'warning',
          content: 'Existing OpenAI notice',
          enabled: true,
        },
      ])
    )

    expect(screen.getByText('Existing OpenAI notice')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add notice' }))

    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByRole('combobox', { name: 'Platform' })
    ).toHaveTextContent('Anthropic')
    await user.click(
      within(dialog).getByRole('combobox', { name: 'Notice type' })
    )
    await user.click(screen.getByRole('option', { name: 'Error' }))
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Notice content' }),
      'Anthropic is temporarily unavailable.'
    )
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))

    expect(
      screen.getByText('Anthropic is temporarily unavailable.')
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save Settings' }))

    await waitFor(() => expect(updateSystemOption).toHaveBeenCalledTimes(1))
    const request = vi.mocked(updateSystemOption).mock.calls[0]?.[0]
    expect(request?.key).toBe('console_setting.channel_status_notices')
    expect(JSON.parse(String(request?.value))).toEqual([
      {
        channel_type: 1,
        level: 'warning',
        content: 'Existing OpenAI notice',
        enabled: true,
      },
      {
        channel_type: 14,
        level: 'error',
        content: 'Anthropic is temporarily unavailable.',
        enabled: true,
      },
    ])
  })

  test('keeps disabled notices editable while marking them hidden', () => {
    renderSection(
      JSON.stringify([
        {
          channel_type: 1,
          level: 'normal',
          content: 'Prepared notice',
          enabled: false,
        },
      ])
    )

    const row = screen.getByRole('row', { name: /Prepared notice/ })
    expect(within(row).getByText('Normal')).toBeInTheDocument()
    expect(within(row).getByText('Disabled')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Edit' })).toBeEnabled()
  })
})
