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
import type { TFunction } from 'i18next'
import { Bell, ChevronRight, Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { getAnnouncementColorClass } from '@/lib/colors'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'

export interface AnnouncementItem {
  id?: number | string
  type?: string
  title?: string
  content?: string
  extra?: string
  link?: string
  publishDate?: string | Date
}

export type NotificationDialogItem = {
  kind: 'announcement'
  announcement: AnnouncementItem
}

interface NotificationPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  unreadCount: number
  announcements: AnnouncementItem[]
  loading: boolean
  onAnnouncementOpen?: (announcement: AnnouncementItem) => void
  className?: string
}

export interface NotificationPanelProps {
  announcements: AnnouncementItem[]
  loading: boolean
  onAnnouncementOpen?: (announcement: AnnouncementItem) => void
  showHeader?: boolean
  contentClassName?: string
}

/**
 * Get relative time string from a date
 */
function getRelativeTime(publishDate: string | Date, t: TFunction): string {
  if (!publishDate) return ''

  const now = new Date()
  const pubDate = new Date(publishDate)

  // If invalid date, return original string
  if (Number.isNaN(pubDate.getTime())) {
    return typeof publishDate === 'string' ? publishDate : ''
  }

  const diffMs = now.getTime() - pubDate.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  // If future time, show specific date
  if (diffMs < 0) return formatDateTimeObject(pubDate)

  // Return relative time based on difference
  if (diffSeconds < 60) return t('Just now')
  if (diffMinutes < 60) {
    return diffMinutes === 1
      ? t('1 minute ago')
      : t('{{count}} minutes ago', { count: diffMinutes })
  }
  if (diffHours < 24) {
    return diffHours === 1
      ? t('1 hour ago')
      : t('{{count}} hours ago', { count: diffHours })
  }
  if (diffDays < 7) {
    return diffDays === 1
      ? t('1 day ago')
      : t('{{count}} days ago', { count: diffDays })
  }
  if (diffWeeks < 4) {
    return diffWeeks === 1
      ? t('1 week ago')
      : t('{{count}} weeks ago', { count: diffWeeks })
  }
  if (diffMonths < 12) {
    return diffMonths === 1
      ? t('1 month ago')
      : t('{{count}} months ago', { count: diffMonths })
  }
  if (diffYears < 2) return t('1 year ago')

  // Over 2 years, show specific date
  return formatDateTimeObject(pubDate)
}

/**
 * Announcement icon with status indicator
 */
function AnnouncementIcon({ type }: { type?: string }) {
  return (
    <span
      className='bg-warning/10 text-warning ring-warning/20 relative flex size-9 shrink-0 items-center justify-center rounded-lg ring-1'
      aria-hidden='true'
    >
      <Megaphone className='size-4' />
      <span
        className={cn(
          'ring-background absolute right-1 bottom-1 size-2 rounded-full ring-2',
          getAnnouncementColorClass(type)
        )}
      />
    </span>
  )
}

function getAnnouncementRenderKey(announcement: AnnouncementItem): string {
  if (announcement.id !== undefined && announcement.id !== null) {
    return `id:${announcement.id}`
  }

  return JSON.stringify({
    content: announcement.content ?? '',
    extra: announcement.extra ?? '',
    publishDate: announcement.publishDate ?? '',
    type: announcement.type ?? '',
  })
}

/**
 * Empty state component
 */
function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description?: string
}) {
  return (
    <Empty className='h-full min-h-0 border-0 p-4'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
    </Empty>
  )
}

/**
 * Announcement list content
 */
function AnnouncementsContent({
  announcements,
  loading,
  onAnnouncementOpen,
  t,
}: {
  announcements: AnnouncementItem[]
  loading: boolean
  onAnnouncementOpen?: (announcement: AnnouncementItem) => void
  t: TFunction
}) {
  if (loading) {
    return (
      <EmptyState
        icon={<Megaphone />}
        title={t('Loading...')}
        description={t('Latest platform updates and notices')}
      />
    )
  }

  if (announcements.length === 0) {
    return (
      <EmptyState icon={<Megaphone />} title={t('No system announcements')} />
    )
  }

  return (
    <ScrollArea className='h-full pr-3'>
      <div className='flex flex-col'>
        {announcements.map((item, idx) => {
          const announcementKey = getAnnouncementRenderKey(item)
          const publishDate = item.publishDate
            ? new Date(item.publishDate)
            : null
          const relativeTime = publishDate
            ? getRelativeTime(publishDate, t)
            : ''
          const absoluteTime = publishDate
            ? formatDateTimeObject(publishDate)
            : ''
          const title =
            item.extra?.trim() ||
            item.title?.trim() ||
            item.content?.trim() ||
            t('Announcement Details')

          return (
            <div key={announcementKey}>
              <button
                type='button'
                className='hover:bg-muted/45 focus-visible:ring-ring/50 -mx-2 block w-[calc(100%+1rem)] rounded-md px-2 py-3 text-left transition-colors outline-none focus-visible:ring-[3px]'
                onClick={() => onAnnouncementOpen?.(item)}
              >
                <div className='flex items-center gap-3'>
                  <AnnouncementIcon type={item.type} />
                  <div className='flex min-w-0 flex-1 flex-col gap-1'>
                    <div className='text-foreground line-clamp-1 text-sm leading-5 font-medium'>
                      {title}
                    </div>
                    {absoluteTime ? (
                      <div className='text-muted-foreground text-xs'>
                        {relativeTime ? `${relativeTime} • ` : null}
                        {absoluteTime}
                      </div>
                    ) : null}
                  </div>
                  <ChevronRight
                    className='text-muted-foreground size-4 shrink-0'
                    aria-hidden='true'
                  />
                </div>
              </button>
              {idx < announcements.length - 1 ? <Separator /> : null}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

/**
 * Shared announcement content used by the header popover.
 */
export function NotificationPanel({
  announcements,
  loading,
  onAnnouncementOpen,
  showHeader = true,
  contentClassName = '',
}: NotificationPanelProps) {
  const { t } = useTranslation()
  return (
    <>
      {showHeader ? (
        <div className='flex flex-col gap-1'>
          <h2 className='flex items-center gap-2 text-base leading-none font-medium'>
            <span
              className='bg-warning/10 text-warning ring-warning/20 flex size-7 shrink-0 items-center justify-center rounded-md ring-1'
              aria-hidden='true'
            >
              <Megaphone className='size-3.5' />
            </span>
            <span>{t('Announcements')}</span>
          </h2>
          <p className='text-muted-foreground text-xs'>
            {t('Latest platform updates and notices')}
          </p>
        </div>
      ) : null}

      <div className={cn('min-h-0 overflow-hidden text-sm', contentClassName)}>
        <AnnouncementsContent
          announcements={announcements}
          loading={loading}
          onAnnouncementOpen={onAnnouncementOpen}
          t={t}
        />
      </div>
    </>
  )
}

/**
 * Notification popover for announcements.
 */
export function NotificationPopover({
  open,
  onOpenChange,
  unreadCount,
  announcements,
  loading,
  onAnnouncementOpen,
  className,
}: NotificationPopoverProps) {
  const { t } = useTranslation()
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant='ghost'
            size='icon'
            className={cn('relative size-9', className)}
            aria-label={t('Notifications')}
          />
        }
      >
        <Bell className='size-[1.2rem]' />
        {unreadCount > 0 ? (
          <Badge
            variant='destructive'
            className='absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center px-1 text-[10px] font-semibold tabular-nums'
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align='end'
        sideOffset={8}
        collisionPadding={8}
        className='grid max-h-[70vh] w-[min(26rem,calc(100vw-1rem))] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden p-3'
      >
        <NotificationPanel
          announcements={announcements}
          loading={loading}
          onAnnouncementOpen={onAnnouncementOpen}
        />

        <div className='flex justify-end'>
          <Button size='sm' onClick={() => onOpenChange(false)}>
            {t('Close')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
