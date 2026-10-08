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
import { zodResolver } from '@hookform/resolvers/zod'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { describe, expect, test } from 'vitest'

import { Form } from '@/components/ui/form'

import {
  buildSettingJSON,
  channelFormSchema,
  CHANNEL_FORM_DEFAULT_VALUES,
  transformChannelToFormDefaults,
  type ChannelFormValues,
} from '../../lib/channel-form'
import { channelSchema } from '../../types'
import { ClaudeStreamDrainSetting } from '../claude-stream-drain-setting'

function SettingsForm(props: {
  channelType: number
  disabled?: boolean
  onSave: (value: string) => void
}) {
  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      ...CHANNEL_FORM_DEFAULT_VALUES,
      type: props.channelType,
      name: 'Claude',
      models: 'claude-test',
      group: ['default'],
      base_url: 'https://claude.example',
      advanced_custom: JSON.stringify({
        advanced_routes: [
          {
            incoming_path: '/v1/messages',
            upstream_path: '/v1/messages',
            converter: 'none',
          },
        ],
      }),
    },
  })
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) =>
          props.onSave(buildSettingJSON(values))
        )}
      >
        <ClaudeStreamDrainSetting
          channelType={props.channelType}
          disabled={props.disabled}
        />
        <button type='submit'>Save</button>
      </form>
    </Form>
  )
}

describe('Claude collection after disconnect', () => {
  test.each([14, 58, 59, 60])(
    'channel %s saves switch and timeout and reloads them',
    async (channelType) => {
      const user = userEvent.setup()
      const saved: string[] = []
      render(
        <SettingsForm
          channelType={channelType}
          onSave={(value) => saved.push(value)}
        />
      )
      const toggle = screen.getByRole('switch', {
        name: 'Collect Claude usage after disconnect',
      })
      expect(toggle).not.toBeChecked()
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
      await user.click(toggle)
      const timeout = screen.getByRole('spinbutton', {
        name: 'Collection timeout after disconnect (seconds)',
      })
      expect(timeout).toHaveValue(300)
      await user.clear(timeout)
      await user.type(timeout, '90')
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(saved).toHaveLength(1))
      expect(JSON.parse(saved[0])).toMatchObject({
        claude_stream_drain_enabled: true,
        claude_stream_drain_timeout: 90,
      })
      const channel = channelSchema.parse({
        id: 1,
        name: 'Claude',
        key: '',
        type: channelType,
        status: 1,
        created_time: 0,
        test_time: 0,
        response_time: 0,
        balance_updated_time: 0,
        setting: saved[0],
      })
      expect(transformChannelToFormDefaults(channel)).toMatchObject({
        claude_stream_drain_enabled: true,
        claude_stream_drain_timeout: 90,
      })
      toggle.focus()
      await user.keyboard(' ')
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(JSON.parse(saved[1]).claude_stream_drain_enabled).toBeUndefined()
    }
  )

  test('rejects out-of-range collection timeouts', async () => {
    const user = userEvent.setup()
    const saved: string[] = []
    render(
      <SettingsForm channelType={14} onSave={(value) => saved.push(value)} />
    )
    await user.click(screen.getByRole('switch'))
    const timeout = screen.getByRole('spinbutton')
    await user.clear(timeout)
    await user.type(timeout, '1801')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('Enter a whole number from 1 to 1800')
    ).toBeVisible()
    expect(timeout).toHaveAttribute('aria-invalid', 'true')
    expect(saved).toEqual([])
    await user.click(screen.getByRole('switch'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(JSON.parse(saved[0]).claude_stream_drain_enabled).toBeUndefined()
  })

  test('locked settings cannot be enabled', async () => {
    const user = userEvent.setup()
    render(<SettingsForm channelType={14} disabled onSave={() => undefined} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-disabled', 'true')
    await user.click(toggle)
    expect(toggle).not.toBeChecked()
  })

  test.each([1, 33, 41])(
    'unrelated or SDK channel %s hides and omits the setting',
    (channelType) => {
      render(
        <SettingsForm channelType={channelType} onSave={() => undefined} />
      )
      expect(screen.queryByRole('switch')).not.toBeInTheDocument()
      expect(
        JSON.parse(
          buildSettingJSON({
            ...CHANNEL_FORM_DEFAULT_VALUES,
            type: channelType,
            claude_stream_drain_enabled: true,
          })
        ).claude_stream_drain_enabled
      ).toBeUndefined()
    }
  )
})
