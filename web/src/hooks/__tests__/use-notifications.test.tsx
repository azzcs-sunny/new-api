/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { useNotificationStore } from '@/stores/notification-store'

import { useNotifications } from '../use-notifications'

const mocks = vi.hoisted(() => ({
  useStatus: vi.fn(),
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: mocks.useStatus,
}))

const unreadAnnouncement = {
  id: 7,
  extra: 'Maintenance window',
  content: 'Maintenance details',
  publishDate: '2026-09-15T08:00:00.000Z',
}

describe('useNotifications auto prompt', () => {
  beforeEach(() => {
    mocks.useStatus.mockReset()
    mocks.useStatus.mockReturnValue({
      status: {
        announcements_enabled: true,
        announcements: [unreadAnnouncement],
      },
      loading: false,
    })
    useNotificationStore.setState({ readAnnouncementKeys: [] })
  })

  test('opens the announcement detail when the page has an unread announcement', async () => {
    const { result } = renderHook(() => useNotifications({ autoPrompt: true }))

    await waitFor(() =>
      expect(result.current.notificationDialogOpen).toBe(true)
    )
    expect(result.current.notificationDialogItem).toEqual({
      kind: 'announcement',
      announcement: unreadAnnouncement,
    })
    expect(result.current.notificationDialogRead).toBe(false)

    act(() => result.current.setNotificationDialogOpen(false))

    expect(result.current.isAnnouncementRead(unreadAnnouncement)).toBe(true)
  })
})
