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
import type { ChannelStatusResponse } from '@/features/channel-status/types'
import { api } from '@/lib/api'

export async function getAllChannelStatus() {
  const response = await api.get<ChannelStatusResponse>(
    '/api/channel-monitor/status'
  )
  return response.data
}

export async function clearChannelTestData(channelId: number) {
  const response = await api.delete<{
    success: boolean
    message?: string
    data: { deleted_count: number }
  }>(`/api/channel-monitor/channels/${channelId}/test-records`)
  return response.data
}

export async function updateChannelStatusVisibility(
  channelId: number,
  visible: boolean
) {
  const response = await api.put<{
    success: boolean
    message?: string
    data: { visible: boolean }
  }>(`/api/channel-monitor/channels/${channelId}/visibility`, { visible })
  return response.data
}

export async function updateChannelActiveTestEnabled(
  channelId: number,
  enabled: boolean
) {
  const response = await api.put<{
    success: boolean
    message?: string
    data: { active_test_enabled: boolean }
  }>(`/api/channel-monitor/channels/${channelId}/active-test`, { enabled })
  return response.data
}

export async function updateChannelStatusHealthyThreshold(
  healthySeconds: number
) {
  const response = await api.put<{
    success: boolean
    message?: string
    data: { healthy_seconds: number; degraded_latency_ms: number }
  }>('/api/channel-monitor/healthy-threshold', {
    healthy_seconds: healthySeconds,
  })
  return response.data
}
