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
import { Loader2, Zap } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { useApiInfo } from '@/features/dashboard/hooks/use-status-data'
import {
  getDefaultPingStatus,
  getLatencyColorClass,
  testUrlLatency,
} from '@/features/dashboard/lib/api-info'
import type {
  ApiInfoItem,
  PingStatus,
  PingStatusMap,
} from '@/features/dashboard/types'
import { cn } from '@/lib/utils'

type ApiKeysApiInfoShortcutsViewProps = {
  items: ApiInfoItem[]
  pingStatus: PingStatusMap
  onTest: (url: string) => void
}

function getStatusForUrl(
  pingStatus: PingStatusMap,
  url: string
): PingStatus {
  return pingStatus[url] || getDefaultPingStatus()
}

export function ApiKeysApiInfoShortcutsView(
  props: ApiKeysApiInfoShortcutsViewProps
) {
  const { t } = useTranslation()

  if (props.items.length === 0) return null

  return (
    <div className='flex min-w-0 flex-wrap items-center gap-2'>
      {props.items.map((item) => {
        const status = getStatusForUrl(props.pingStatus, item.url)
        const title = item.route || item.description || item.url

        return (
          <div
            key={`${item.route}:${item.url}`}
            className='border-border bg-muted/40 text-foreground flex h-9 min-w-0 max-w-full items-center gap-2 rounded-lg border px-2.5 text-xs shadow-xs sm:max-w-[28rem]'
            title={item.description || title}
          >
            <span className='max-w-[11rem] min-w-0 truncate font-medium'>
              {title}
            </span>
            <span className='text-muted-foreground/60'>|</span>
            <span className='text-muted-foreground min-w-0 truncate font-mono'>
              {item.url}
            </span>
            {status.latency !== null && !status.testing && (
              <span
                className={cn(
                  'hidden shrink-0 font-mono text-[11px] tabular-nums sm:inline',
                  getLatencyColorClass(status.latency)
                )}
              >
                {status.latency}
                {t('ms')}
              </span>
            )}
            <CopyButton
              value={item.url}
              variant='ghost'
              size='sm'
              className='text-muted-foreground hover:text-foreground size-6 p-0'
              iconClassName='size-3.5'
              tooltip={t('Copy URL')}
              aria-label={t('Copy URL')}
            />
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-muted-foreground hover:text-foreground size-6 p-0'
              onClick={() => props.onTest(item.url)}
              disabled={status.testing}
              title={t('Test Latency')}
              aria-label={t('Test Latency')}
            >
              {status.testing ? (
                <Loader2 aria-hidden='true' className='size-3.5 animate-spin' />
              ) : (
                <Zap aria-hidden='true' className='size-3.5' />
              )}
            </Button>
          </div>
        )
      })}
    </div>
  )
}

export function ApiKeysApiInfoShortcuts() {
  const { items } = useApiInfo()
  const [pingStatus, setPingStatus] = useState<PingStatusMap>({})

  const handleTest = useCallback(async (url: string) => {
    setPingStatus((prev) => ({
      ...prev,
      [url]: { latency: null, testing: true, error: false },
    }))

    const result = await testUrlLatency(url)
    setPingStatus((prev) => ({ ...prev, [url]: result }))
  }, [])

  return (
    <ApiKeysApiInfoShortcutsView
      items={items}
      pingStatus={pingStatus}
      onTest={handleTest}
    />
  )
}
