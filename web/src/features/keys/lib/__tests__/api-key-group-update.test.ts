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
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { ApiKey } from '../../types'

const { getMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: {
    get: getMock,
    put: putMock,
  },
}))

const { updateApiKeyGroup } = await import('../../api')

const apiKey: ApiKey = {
  id: 7,
  name: 'production',
  key: 'masked',
  status: 1,
  remain_quota: 123,
  used_quota: 45,
  unlimited_quota: false,
  expired_time: 2_000_000_000,
  created_time: 1_900_000_000,
  accessed_time: 1_950_000_000,
  group: 'default',
  auto_groups: null,
  cross_group_retry: false,
  model_limits_enabled: true,
  model_limits: 'gpt-4o,claude-3-5-sonnet',
  allow_ips: '192.0.2.1',
}

describe('updateApiKeyGroup', () => {
  beforeEach(() => {
    getMock.mockReset()
    putMock.mockReset()
    putMock.mockResolvedValue({ data: { success: true, data: apiKey } })
  })

  test('switches a normal key to Auto without changing its latest restrictions', async () => {
    getMock.mockResolvedValue({ data: { success: true, data: apiKey } })

    await updateApiKeyGroup(apiKey.id, 'auto')

    expect(getMock).toHaveBeenCalledWith(`/api/token/${apiKey.id}`)
    expect(putMock).toHaveBeenCalledWith('/api/token/', {
      id: apiKey.id,
      name: apiKey.name,
      remain_quota: apiKey.remain_quota,
      expired_time: apiKey.expired_time,
      unlimited_quota: apiKey.unlimited_quota,
      model_limits_enabled: apiKey.model_limits_enabled,
      model_limits: apiKey.model_limits,
      allow_ips: apiKey.allow_ips,
      group: 'auto',
      auto_groups: [],
      cross_group_retry: true,
    })
  })

  test('clears Auto-only settings when switching to a fixed group', async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          ...apiKey,
          group: 'auto',
          auto_groups: ['vip', 'default'],
          cross_group_retry: true,
        },
      },
    })

    await updateApiKeyGroup(apiKey.id, 'vip')

    expect(putMock).toHaveBeenCalledWith(
      '/api/token/',
      expect.objectContaining({
        group: 'vip',
        auto_groups: [],
        cross_group_retry: false,
      })
    )
  })

  test('does not submit an update when the latest key cannot be loaded', async () => {
    getMock.mockResolvedValue({
      data: { success: false, message: 'load failed' },
    })

    const result = await updateApiKeyGroup(apiKey.id, 'vip')

    expect(result).toEqual({ success: false, message: 'load failed' })
    expect(putMock).not.toHaveBeenCalled()
  })
})
