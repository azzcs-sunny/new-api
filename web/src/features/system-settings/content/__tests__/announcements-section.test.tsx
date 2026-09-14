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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'

import { AnnouncementsSection } from '../announcements-section'

function renderAnnouncementsSection(data = '[]') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const result = render(
    <QueryClientProvider client={queryClient}>
      <AnnouncementsSection enabled data={data} />
    </QueryClientProvider>
  )

  return {
    ...result,
    queryClient,
  }
}

describe('announcements section', () => {
  test('places the required title field before content in the announcement dialog', async () => {
    const user = userEvent.setup()
    renderAnnouncementsSection()

    await user.click(screen.getByRole('button', { name: 'Add Announcement' }))

    const dialog = screen.getByRole('dialog')
    const titleInput = within(dialog).getByLabelText('Title')
    const contentInput = within(dialog).getByLabelText('Content')

    expect(titleInput.compareDocumentPosition(contentInput)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(titleInput).toHaveAttribute(
      'placeholder',
      'Enter announcement title'
    )
    expect(
      within(dialog).queryByText(
        'Optional supplementary information (max 100 characters)'
      )
    ).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Add' }))

    expect(titleInput).toHaveAttribute('aria-invalid', 'true')
    expect(within(dialog).getByText('Title is required')).toBeInTheDocument()
  })

  test('shows extra as the title column before announcement content', () => {
    const data = JSON.stringify([
      {
        id: 1,
        extra: 'Maintenance window',
        content: 'The dashboard will be updated tonight.',
        publishDate: '2026-09-14T12:00:00.000Z',
        type: 'default',
      },
    ])
    renderAnnouncementsSection(data)

    const titleHeader = screen.getByRole('columnheader', { name: 'Title' })
    const contentHeader = screen.getByRole('columnheader', { name: 'Content' })

    expect(titleHeader.compareDocumentPosition(contentHeader)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(screen.getByText('Maintenance window')).toBeInTheDocument()
    expect(
      screen.getByText('The dashboard will be updated tonight.')
    ).toBeInTheDocument()
  })
})
