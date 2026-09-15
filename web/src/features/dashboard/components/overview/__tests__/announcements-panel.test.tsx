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

import { useAnnouncements } from '@/features/dashboard/hooks/use-status-data'
import { useNotificationStore } from '@/stores/notification-store'

import { AnnouncementsPanel } from '../announcements-panel'

vi.mock('@/features/dashboard/hooks/use-status-data', () => ({
  useAnnouncements: vi.fn(),
}))

const originalGetAnimations = HTMLElement.prototype.getAnimations

beforeAll(() => {
  HTMLElement.prototype.getAnimations = () => []
})

afterAll(() => {
  HTMLElement.prototype.getAnimations = originalGetAnimations
})

describe('dashboard announcements panel', () => {
  test('uses extra as the card title and opens the shared announcement detail', async () => {
    const user = userEvent.setup()
    vi.mocked(useAnnouncements).mockReturnValue({
      items: [
        {
          id: 1,
          extra: 'Maintenance window',
          content: '**Dashboard body**',
          publishDate: '2026-08-21T08:00:00.000Z',
          type: 'warning',
        },
      ],
      loading: false,
    })
    useNotificationStore.setState({ readAnnouncementKeys: [] })

    render(<AnnouncementsPanel />)

    expect(screen.getByText('Maintenance window')).toBeInTheDocument()
    expect(screen.queryByText('Click for details')).not.toBeInTheDocument()
    const itemButton = screen.getByRole('button', {
      name: /Maintenance window/,
    })
    expect(within(itemButton).getByText('Unread')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard body')).not.toBeInTheDocument()

    await user.click(itemButton)

    expect(screen.getAllByText('Announcements')).toHaveLength(2)
    expect(screen.getAllByText('Unread')).toHaveLength(2)
    expect(screen.getByText('Dashboard body').tagName).toBe('STRONG')

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(within(itemButton).getByText('Read')).toBeInTheDocument()
  })
})
