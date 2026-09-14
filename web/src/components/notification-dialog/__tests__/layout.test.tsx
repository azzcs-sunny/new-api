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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { NotificationDialog } from '../../notification-dialog'
import { NotificationPopover } from '../../notification-popover'

const announcements = [
  {
    id: 1,
    extra: 'Maintenance window',
    content: '<strong>HTML notice</strong>\n\n**Markdown notice**',
    publishDate: '2026-08-21T08:00:00.000Z',
  },
]

const originalGetAnimations = HTMLElement.prototype.getAnimations

beforeAll(() => {
  HTMLElement.prototype.getAnimations = () => []
})

afterAll(() => {
  HTMLElement.prototype.getAnimations = originalGetAnimations
})

describe('NotificationDialog layout', () => {
  test('renders announcement extra as title and supports HTML plus Markdown body', () => {
    render(
      <NotificationDialog
        open
        onOpenChange={() => undefined}
        item={{ kind: 'announcement', announcement: announcements[0] }}
        loading={false}
      />
    )

    expect(screen.getByText('Announcements')).toBeInTheDocument()
    expect(screen.getByText('Maintenance window')).toBeInTheDocument()
    expect(screen.getByText('HTML notice').tagName).toBe('STRONG')
    expect(screen.getByText('Markdown notice').tagName).toBe('STRONG')
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  test('caps the announcement detail content height', () => {
    render(
      <NotificationDialog
        open
        onOpenChange={() => undefined}
        item={{ kind: 'announcement', announcement: announcements[0] }}
        loading={false}
      />
    )

    expect(
      screen.getByText('Markdown notice').closest('[data-slot="scroll-area"]')
    ).toHaveClass('max-h-[calc(70vh-13rem)]')

    expect(screen.getByRole('alertdialog')).toHaveClass('max-h-[70vh]')
  })

  test('opens announcement details from an announcement item with title, time, and icons', async () => {
    const user = userEvent.setup()
    const onAnnouncementOpen = vi.fn()
    render(
      <NotificationPopover
        open
        onOpenChange={() => undefined}
        unreadCount={1}
        activeTab='announcements'
        onTabChange={() => undefined}
        notice=''
        announcements={announcements}
        loading={false}
        onAnnouncementOpen={onAnnouncementOpen}
      />
    )

    expect(screen.getByText('Announcements')).toBeInTheDocument()
    expect(screen.queryByText('Timeline')).not.toBeInTheDocument()
    expect(screen.queryByText('HTML notice')).not.toBeInTheDocument()

    const itemButton = screen.getByRole('button', {
      name: /Maintenance window/,
    })
    expect(within(itemButton).getByText(/2026/)).toBeInTheDocument()
    expect(itemButton.querySelector('.lucide-megaphone')).toBeInTheDocument()
    expect(
      itemButton.querySelector('.lucide-chevron-right')
    ).toBeInTheDocument()

    await user.click(itemButton)

    expect(onAnnouncementOpen).toHaveBeenCalledWith(announcements[0])
  })

  test('caps the notification center popover height', () => {
    render(
      <NotificationPopover
        open
        onOpenChange={() => undefined}
        unreadCount={1}
        activeTab='announcements'
        onTabChange={() => undefined}
        notice=''
        announcements={announcements}
        loading={false}
      />
    )

    expect(screen.getByRole('dialog')).toHaveClass(
      'max-h-[70vh]',
      'overflow-hidden'
    )
  })
})
