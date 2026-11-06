/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License
as published by the Free Software Foundation, either version 3 of the
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
import { describe, expect, test } from 'vitest'

import { ROLE } from '@/lib/roles'

import { buildSidebarData } from '../use-sidebar-data'

describe('sidebar data', () => {
  const t = ((key: string) => key) as unknown as TFunction

  test('keeps pricing alerts alongside custom navigation entries', () => {
    const data = buildSidebarData(
      t,
      ROLE.SUPER_ADMIN,
      'https://example.com/topup',
      'https://canvas.example.com',
      { modelPricing: '3' }
    )
    const items = data.navGroups.flatMap((group) => group.items)

    expect(items).toContainEqual(
      expect.objectContaining({ title: 'System Settings', badge: '3' })
    )
    for (const url of [
      '/canvas',
      '/channel-status',
      '/channel-monitor',
      '/affiliate',
      '/affiliate-admin',
      '/wallet/card-codes',
      '/invoices?tab=mine',
      '/invoices?tab=management',
    ]) {
      expect(items).toContainEqual(expect.objectContaining({ url }))
    }
  })

  test('puts channel status between dashboard and api keys', () => {
    const sidebarData = buildSidebarData(t)
    const generalGroup = sidebarData.navGroups.find(
      (group) => group.id === 'general'
    )
    const items = generalGroup?.items ?? []
    const dashboardItem = items.find((item) => item.title === 'Dashboard')
    const channelStatusItem = items.find(
      (item) => item.title === 'Channel Status'
    )

    expect(dashboardItem).toMatchObject({
      title: 'Dashboard',
      url: '/dashboard/models',
    })
    expect(channelStatusItem).toMatchObject({
      title: 'Channel Status',
      url: '/channel-status',
    })
    expect(channelStatusItem?.icon).toBeDefined()
    expect(items.map((item) => item.title)).toEqual([
      'Overview',
      'Dashboard',
      'Channel Status',
      'API Keys',
      'Usage Logs',
      'Audit Logs',
      'Task Logs',
    ])
  })

  test('adds the card code purchase entry only when a top-up link is configured', () => {
    const withoutLink = buildSidebarData(t)
    const withLink = buildSidebarData(t, undefined, 'https://example.com/topup')
    const personalWithoutLink = withoutLink.navGroups.find(
      (group) => group.id === 'personal'
    )
    const personalWithLink = withLink.navGroups.find(
      (group) => group.id === 'personal'
    )

    expect(personalWithoutLink?.items.map((item) => item.title)).not.toContain(
      '⭐Purchase Card Codes⭐'
    )
    expect(personalWithLink?.items).toContainEqual(
      expect.objectContaining({
        title: '⭐Purchase Card Codes⭐',
        url: '/wallet/card-codes',
      })
    )
  })

  test.each([undefined, '', '   '])(
    'hides infinite canvas when its link is %s',
    (link) => {
      const data = buildSidebarData(t, ROLE.USER, undefined, link)
      expect(
        data.navGroups.find((group) => group.id === 'chat')?.items
      ).not.toContainEqual(expect.objectContaining({ url: '/canvas' }))
    }
  )

  test('shows infinite canvas when its link is configured', () => {
    const data = buildSidebarData(
      t,
      ROLE.USER,
      undefined,
      'https://canvas.example.com'
    )
    expect(
      data.navGroups.find((group) => group.id === 'chat')?.items
    ).toContainEqual(
      expect.objectContaining({ title: 'Infinite Canvas', url: '/canvas' })
    )
  })

  test('splits admin invoice management from personal invoice requests', () => {
    const sidebarData = buildSidebarData(t, ROLE.ADMIN)
    const personalGroup = sidebarData.navGroups.find(
      (group) => group.id === 'personal'
    )
    const adminGroup = sidebarData.navGroups.find(
      (group) => group.id === 'admin'
    )

    expect(personalGroup?.items).toContainEqual(
      expect.objectContaining({
        title: 'My invoice requests',
        url: '/invoices?tab=mine',
        configUrls: ['/invoices'],
      })
    )
    expect(adminGroup?.items).toContainEqual(
      expect.objectContaining({
        title: 'Invoice Management',
        url: '/invoices?tab=management',
        activeUrls: ['/invoices'],
      })
    )
  })
})
