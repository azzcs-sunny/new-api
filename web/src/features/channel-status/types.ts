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
export type ChannelHealth = 'unknown' | 'healthy' | 'warning' | 'critical'

export type ChannelTestRecord = {
  id: number
  model_name: string
  success: boolean
  latency_ms: number
  tested_at: number
}

export type ChannelStatusRow = {
  channel_id?: number
  channel_name?: string
  provider?: string
  channel_status?: number
  group: string
  group_ratios?: Record<string, number>
  model_name: string
  health: ChannelHealth
  latency_ms: number
  recent_success_rate?: number
  latest_checked_at?: number
  records: ChannelTestRecord[]
}

export type ChannelStatusResult = {
  items: ChannelStatusRow[]
}

export type ChannelStatusResponse = {
  success: boolean
  message?: string
  data: ChannelStatusResult
}
