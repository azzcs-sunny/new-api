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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type {
  AnnouncementItem,
  NotificationDialogItem,
} from '@/components/notification-popover'
import { useStatus } from '@/hooks/use-status'
import { getAnnouncementKey } from '@/lib/announcement'
import { useNotificationStore } from '@/stores/notification-store'

function getUnreadAnnouncements(
  announcements: AnnouncementItem[],
  isAnnouncementRead: (announcement: AnnouncementItem) => boolean
) {
  return announcements.filter((item) => !isAnnouncementRead(item))
}

/**
 * Hook to manage announcements
 * Provides unread counts and read status management
 */
type UseNotificationsOptions = {
  autoPrompt?: boolean
}

export function useNotifications({
  autoPrompt = false,
}: UseNotificationsOptions = {}) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false)
  const [selectedDialogItem, setSelectedDialogItem] =
    useState<NotificationDialogItem | null>(null)
  const autoPromptShown = useRef(false)

  // Fetch Announcements from status
  const { status, loading: statusLoading } = useStatus()
  const announcementsEnabled = status?.announcements_enabled ?? false
  const announcements = useMemo<AnnouncementItem[]>(() => {
    if (!announcementsEnabled) return []
    return ((status?.announcements || []) as AnnouncementItem[]).slice(0, 20)
  }, [announcementsEnabled, status?.announcements])

  // Notification store
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

  // Calculate unread counts
  const unreadCounts = useMemo(() => {
    const announcementsUnread = getUnreadAnnouncements(
      announcements,
      isAnnouncementRead
    ).length

    return {
      announcements: announcementsUnread,
      total: announcementsUnread,
    }
  }, [announcements, isAnnouncementRead])

  const firstUnreadDialogItem = useMemo<NotificationDialogItem | null>(() => {
    const firstAnnouncement = getUnreadAnnouncements(
      announcements,
      isAnnouncementRead
    )[0]
    return firstAnnouncement
      ? {
          kind: 'announcement',
          announcement: firstAnnouncement,
        }
      : null
  }, [announcements, isAnnouncementRead])
  const dialogItem = selectedDialogItem ?? firstUnreadDialogItem
  const notificationDialogRead = dialogItem
    ? isAnnouncementRead(dialogItem.announcement)
    : false

  const markDialogItemAsRead = () => {
    if (!dialogItem) return
    markAnnouncementsRead([getAnnouncementKey(dialogItem.announcement)])
  }

  const handleNotificationDialogOpenChange = (open: boolean) => {
    if (!open) {
      markDialogItemAsRead()
      setSelectedDialogItem(null)
    }
    setNotificationDialogOpen(open)
  }

  const openAnnouncementDetail = (announcement: AnnouncementItem) => {
    setSelectedDialogItem({ kind: 'announcement', announcement })
    setPopoverOpen(false)
    setNotificationDialogOpen(true)
  }

  useEffect(() => {
    if (
      !autoPrompt ||
      autoPromptShown.current ||
      statusLoading ||
      !firstUnreadDialogItem
    ) {
      return
    }

    autoPromptShown.current = true
    setNotificationDialogOpen(true)
  }, [autoPrompt, firstUnreadDialogItem, statusLoading])

  // Handle popover open
  const handleOpenPopover = () => {
    setPopoverOpen(true)
  }

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      handleOpenPopover()
      return
    }

    setPopoverOpen(false)
  }

  return {
    // Data
    announcements,
    loading: statusLoading,

    // Unread counts
    unreadCount: unreadCounts.total,
    unreadAnnouncementsCount: unreadCounts.announcements,

    // Popover state
    popoverOpen,
    setPopoverOpen: handlePopoverOpenChange,

    // Actions
    openPopover: handleOpenPopover,
    closePopover: () => setPopoverOpen(false),
    notificationDialogOpen,
    setNotificationDialogOpen: handleNotificationDialogOpenChange,
    notificationDialogItem: dialogItem,
    notificationDialogRead,
    isAnnouncementRead,
    openAnnouncementDetail,
  }
}
