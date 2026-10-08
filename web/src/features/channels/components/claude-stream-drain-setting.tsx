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
import { useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

import type { ChannelFormValues } from '../lib/channel-form'
import { supportsClaudeStreamDrain } from '../lib/claude-stream-drain'

export function ClaudeStreamDrainSetting(props: {
  channelType: number
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const form = useFormContext<ChannelFormValues>()
  const enabled = useWatch({
    control: form.control,
    name: 'claude_stream_drain_enabled',
  })
  if (!supportsClaudeStreamDrain(props.channelType)) return null

  return (
    <div className='space-y-3 px-4 py-3'>
      <FormField
        control={form.control}
        name='claude_stream_drain_enabled'
        render={({ field }) => (
          <FormItem className='flex items-center justify-between gap-4'>
            <div className='space-y-0.5'>
              <FormLabel>
                {t('Collect Claude usage after disconnect')}
              </FormLabel>
              <FormDescription>
                {t(
                  'Only applies to upstream Claude Messages streams. After a client disconnects, generation continues and billing uses the collected upstream usage.'
                )}
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value === true}
                onCheckedChange={field.onChange}
                disabled={props.disabled}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            </FormControl>
          </FormItem>
        )}
      />
      {enabled && (
        <FormField
          control={form.control}
          name='claude_stream_drain_timeout'
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('Collection timeout after disconnect (seconds)')}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type='number'
                  min={1}
                  max={1800}
                  step={1}
                  value={field.value || ''}
                  onChange={(event) =>
                    field.onChange(Number(event.target.value))
                  }
                  disabled={props.disabled}
                />
              </FormControl>
              <FormDescription>
                {t(
                  'Default: 300 seconds. Range: 1–1800 seconds. Existing upstream and stream idle timeouts still apply.'
                )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  )
}
