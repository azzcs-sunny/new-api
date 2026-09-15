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
import { ChevronRight, Megaphone } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NotificationDialog } from '@/components/notification-dialog'
import { Badge } from '@/components/ui/badge'
import { IconBadge } from '@/components/ui/icon-badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAnnouncements } from '@/features/dashboard/hooks/use-status-data'
import { getPreviewText } from '@/features/dashboard/lib'
import type { AnnouncementItem } from '@/features/dashboard/types'
import { getAnnouncementKey } from '@/lib/announcement'
import { getAnnouncementColorClass } from '@/lib/colors'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/stores/notification-store'

import { PanelWrapper } from '../ui/panel-wrapper'

const AnnouncementStatusDot = memo(function AnnouncementStatusDot(props: {
  type?: string
}) {
  return (
    <span
      className={cn(
        'ring-card absolute right-0.5 bottom-0.5 inline-block size-2 rounded-full ring-2',
        getAnnouncementColorClass(props.type)
      )}
    />
  )
})

export function AnnouncementsPanel() {
  const { t } = useTranslation()
  const { items: list, loading } = useAnnouncements()
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<AnnouncementItem | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const readAnnouncementKeys = useNotificationStore(
    (state) => state.readAnnouncementKeys
  )
  const markAnnouncementsRead = useNotificationStore(
    (state) => state.markAnnouncementsRead
  )
  const isAnnouncementRead = useCallback(
    (announcement: AnnouncementItem) =>
      readAnnouncementKeys.includes(getAnnouncementKey(announcement)),
    [readAnnouncementKeys]
  )

  const handleAnnouncementClick = (item: AnnouncementItem) => {
    setSelectedAnnouncement(item)
    setIsDialogOpen(true)
  }

  const handleDialogOpenChange = (open: boolean) => {
    if (!open && selectedAnnouncement) {
      markAnnouncementsRead([getAnnouncementKey(selectedAnnouncement)])
    }
    setIsDialogOpen(open)
  }

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <IconBadge
            tone='warning'
            size='sm'
            className='ring-warning/20 ring-1'
          >
            <Megaphone />
          </IconBadge>
          {t('Announcements')}
        </span>
      }
      description={t('Latest platform updates and notices')}
      loading={loading}
      empty={!list.length}
      emptyMessage={t('No announcements at this time')}
      height='h-72'
      contentClassName='p-0'
    >
      <ScrollArea className='h-72'>
        <div>
          {list.map((item: AnnouncementItem, idx: number) => {
            const key = item.id ?? `announcement-${idx}`
            const read = isAnnouncementRead(item)
            return (
              <button
                key={key}
                type='button'
                onClick={() => handleAnnouncementClick(item)}
                className={cn(
                  'hover:bg-muted/40 w-full px-3 py-3 text-left transition-colors sm:px-5 sm:py-3.5',
                  idx < list.length - 1 && 'border-border/60 border-b'
                )}
              >
                <div className='flex items-center gap-2.5'>
                  <span className='relative shrink-0'>
                    <IconBadge
                      tone='warning'
                      size='sm'
                      className='ring-warning/20 ring-1'
                    >
                      <Megaphone />
                    </IconBadge>
                    <AnnouncementStatusDot type={item.type} />
                  </span>
                  <div className='flex min-w-0 flex-1 flex-col gap-1'>
                    <p className='line-clamp-1 text-sm font-medium'>
                      {item.extra?.trim() || getPreviewText(item.content)}
                    </p>
                    {item.publishDate && (
                      <time className='text-muted-foreground/60 text-xs'>
                        {formatDateTimeObject(new Date(item.publishDate))}
                      </time>
                    )}
                  </div>
                  <Badge
                    variant={read ? 'outline' : 'warning'}
                    className='h-5 rounded-md px-1.5 text-[10px]'
                  >
                    {t(read ? 'Read' : 'Unread')}
                  </Badge>
                  <ChevronRight
                    className='text-muted-foreground/60 size-4 shrink-0'
                    aria-hidden='true'
                  />
                </div>
              </button>
            )
          })}
        </div>
      </ScrollArea>

      <NotificationDialog
        open={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
        item={
          selectedAnnouncement
            ? { kind: 'announcement', announcement: selectedAnnouncement }
            : null
        }
        loading={loading}
        read={
          selectedAnnouncement
            ? isAnnouncementRead(selectedAnnouncement)
            : false
        }
      />
    </PanelWrapper>
  )
}
