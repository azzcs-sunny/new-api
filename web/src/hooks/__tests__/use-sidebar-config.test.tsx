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
import { renderHook } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { useSidebarConfig } from '../use-sidebar-config'
import { buildSidebarData } from '../use-sidebar-data'

const { mockUseAuthStore, mockUseStatus } = vi.hoisted(() => ({
  mockUseAuthStore: vi.fn(),
  mockUseStatus: vi.fn(),
}))

vi.mock('@/hooks/use-status', () => ({ useStatus: mockUseStatus }))
vi.mock('@/stores/auth-store', () => ({ useAuthStore: mockUseAuthStore }))

const t = ((key: string) => key) as unknown as TFunction
const sidebarGroups = buildSidebarData(t).navGroups

function hasChannelStatus(groups: ReturnType<typeof useSidebarConfig>) {
  return groups.some((group) =>
    group.items.some((item) => 'url' in item && item.url === '/channel-status')
  )
}

describe('channel status sidebar configuration', () => {
  beforeEach(() => {
    mockUseAuthStore.mockReturnValue({ auth: { user: null } })
  })

  test('shows channel status when the admin configuration is empty', () => {
    mockUseStatus.mockReturnValue({ status: { SidebarModulesAdmin: '' } })

    const { result } = renderHook(() => useSidebarConfig(sidebarGroups))

    expect(hasChannelStatus(result.current)).toBe(true)
  })

  test('hides channel status when the admin switch is disabled', () => {
    mockUseStatus.mockReturnValue({
      status: {
        SidebarModulesAdmin: JSON.stringify({
          console: { enabled: true, channelStatus: false },
        }),
      },
    })

    const { result } = renderHook(() => useSidebarConfig(sidebarGroups))

    expect(hasChannelStatus(result.current)).toBe(false)
  })

  test('keeps channel status visible for saved configurations without the new key', () => {
    mockUseStatus.mockReturnValue({
      status: {
        SidebarModulesAdmin: JSON.stringify({
          console: { enabled: true, detail: true },
        }),
      },
    })

    const { result } = renderHook(() => useSidebarConfig(sidebarGroups))

    expect(hasChannelStatus(result.current)).toBe(true)
  })
})
