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

For commercial licensing, please contact support@quantumnous.com
*/
import { Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { RichContent } from '@/components/rich-content'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'

import type { NotificationDialogItem } from './notification-popover'

interface NotificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: NotificationDialogItem | null
  loading: boolean
  read: boolean
}

export function NotificationDialog({
  open,
  onOpenChange,
  item,
  loading,
  read,
}: NotificationDialogProps) {
  const { t } = useTranslation()
  const announcement = item?.announcement ?? null
  const publishDate = announcement?.publishDate
    ? new Date(announcement.publishDate)
    : null
  const formattedPublishDate =
    publishDate && !Number.isNaN(publishDate.getTime())
      ? formatDateTimeObject(publishDate)
      : ''
  const title = announcement?.extra?.trim() || t('Announcement Details')
  const content = announcement?.content || ''

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen, details) => {
        // The mandatory prompt can only be dismissed with its explicit button.
        if (!nextOpen && details.reason !== 'close-press') return
        onOpenChange(nextOpen)
      }}
    >
      <AlertDialogContent
        size='default'
        className='grid max-h-[70vh] w-[min(42rem,calc(100%-2rem))] !max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 shadow-xl'
      >
        <div className='bg-muted/40 flex items-start gap-3 p-5 sm:gap-4 sm:p-6'>
          <div
            className={cn(
              'bg-primary/10 ring-primary/20 flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1',
              'text-primary'
            )}
          >
            <Megaphone className='size-5' aria-hidden='true' />
          </div>
          <div className='flex min-w-0 flex-col gap-1.5 pt-0.5'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant='secondary' className='h-6 rounded-md px-2'>
                {t('Announcements')}
              </Badge>
              <Badge
                variant={read ? 'outline' : 'warning'}
                className='h-6 rounded-md px-2'
              >
                {t(read ? 'Read' : 'Unread')}
              </Badge>
            </div>
            <AlertDialogTitle className='text-lg leading-tight font-semibold'>
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className='text-start text-sm text-pretty'>
              {formattedPublishDate
                ? `${t('Published:')} ${formattedPublishDate}`
                : t('Latest platform updates and notices')}
            </AlertDialogDescription>
          </div>
        </div>
        <Separator />
        <div className='min-h-0 overflow-hidden p-4 sm:p-6'>
          <ScrollArea className='h-full max-h-[calc(70vh-13rem)] pr-3'>
            <div className='border-primary/80 bg-muted/25 border-l-4 py-1 pl-4 text-sm leading-7'>
              <RichContent
                breaks
                content={loading ? t('Loading...') : content}
              />
            </div>
          </ScrollArea>
        </div>
        <AlertDialogFooter className='m-0 rounded-none px-4 py-3 sm:px-6 sm:py-4'>
          <AlertDialogCancel className='sm:min-w-24'>
            {t('Close')}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
