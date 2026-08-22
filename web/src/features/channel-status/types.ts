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

export type ChannelStatusPoint = {
  ts: number
  request_count: number
  success_count: number
  avg_ttft_ms: number
  avg_latency_ms: number
  success_rate: number
  avg_tps: number
  has_data: boolean
}

export type ChannelStatusSummary = {
  avg_ttft_ms: number
  avg_latency_ms: number
  latest_latency_ms: number
  success_rate: number
  avg_tps: number
  health: ChannelHealth
  has_data: boolean
}

export type ChannelStatusRow = {
  channel_type: number
  provider: string
  group: string
  model_name: string
  ping_ms: number
  metrics: ChannelStatusSummary
  series: ChannelStatusPoint[]
}

export type ChannelStatusResult = {
  hours: number
  bucket_seconds: number
  from_ts: number
  through_ts: number
  truncated: boolean
  summary: ChannelStatusSummary
  series: ChannelStatusPoint[]
  items: ChannelStatusRow[]
}

export type ChannelStatusResponse = {
  success: boolean
  message?: string
  data: ChannelStatusResult
}
