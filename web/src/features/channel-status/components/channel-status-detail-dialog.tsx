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
*/
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import type { ChannelHealth, ChannelStatusRow } from '../types'

type ChannelStatusDetailDialogProps = {
  row?: ChannelStatusRow
  onOpenChange: (open: boolean) => void
}

const badgeVariant = {
  unknown: 'outline',
  healthy: 'outline',
  warning: 'warning',
  critical: 'destructive',
} as const

export function ChannelStatusDetailDialog(
  props: ChannelStatusDetailDialogProps
) {
  const { t } = useTranslation()
  const row = props.row
  const health = row?.health ?? 'unknown'
  const latestStatus: Record<ChannelHealth, string> = {
    unknown: t('Unknown'),
    healthy: t('Healthy'),
    warning: t('Degraded'),
    critical: t('Error'),
  }
  const title = row?.channel_name ?? row?.group ?? t('Channel details')

  return (
    <Dialog
      defaultOpen
      onOpenChange={props.onOpenChange}
      title={title}
      contentClassName='sm:max-w-5xl'
      footer={
        <Button variant='outline' onClick={() => props.onOpenChange(false)}>
          {t('Close')}
        </Button>
      }
    >
      {row ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Model')}</TableHead>
              <TableHead>{t('Latest status')}</TableHead>
              <TableHead>{t('Latest latency (ms)')}</TableHead>
              <TableHead>{t('7-day availability')}</TableHead>
              <TableHead>{t('15-day availability')}</TableHead>
              <TableHead>{t('30-day availability')}</TableHead>
              <TableHead>{t('7-day average latency (ms)')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className='max-w-56 truncate font-mono font-medium'>
                {row.model_name}
              </TableCell>
              <TableCell>
                <Badge variant={badgeVariant[health]}>
                  {latestStatus[health]}
                </Badge>
              </TableCell>
              <TableCell>{formatMilliseconds(row.latency_ms)}</TableCell>
              <TableCell>
                {formatAvailability(
                  row.availability_7d,
                  row.availability_7d_samples
                )}
              </TableCell>
              <TableCell>
                {formatAvailability(
                  row.availability_15d,
                  row.availability_15d_samples
                )}
              </TableCell>
              <TableCell>
                {formatAvailability(
                  row.availability_30d,
                  row.availability_30d_samples
                )}
              </TableCell>
              <TableCell>{formatMilliseconds(row.avg_latency_7d_ms)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      ) : null}
    </Dialog>
  )
}

function formatAvailability(
  value: number | undefined,
  samples: number | undefined
) {
  if (!samples) return '—'
  return `${(value ?? 0).toFixed(2)}%`
}

function formatMilliseconds(value: number | undefined) {
  if (value === undefined) return '—'
  return Math.round(Math.max(0, value)).toString()
}
