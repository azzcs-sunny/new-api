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
import type { ChannelStatusPoint } from '../types'

export type UsageRecord = {
  id: string
  status: 'success' | 'failure'
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${value.toFixed(2)}%`
}

export function formatMilliseconds(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return `${Math.round(value)} ms`
}

export function buildUsageRecords(
  series: ChannelStatusPoint[],
  limit = 60
): UsageRecord[] {
  if (!Number.isFinite(limit) || limit <= 0) return []

  const records: UsageRecord[] = []
  const recordLimit = Math.floor(limit)
  for (let index = series.length - 1; index >= 0; index -= 1) {
    const point = series[index]
    const requestCount = Number.isFinite(point.request_count)
      ? Math.max(0, Math.floor(point.request_count))
      : 0
    if (requestCount === 0) continue

    const successCount = Number.isFinite(point.success_count)
      ? Math.max(0, Math.min(requestCount, Math.floor(point.success_count)))
      : 0
    const remaining = recordLimit - records.length
    const take = Math.min(requestCount, remaining)
    const successes = Math.round((successCount / requestCount) * take)
    const bucketRecords: UsageRecord[] = []
    for (let ordinal = 0; ordinal < successes; ordinal += 1) {
      bucketRecords.push({
        id: `${point.ts}-success-${ordinal}`,
        status: 'success',
      })
    }
    for (let ordinal = 0; ordinal < take - successes; ordinal += 1) {
      bucketRecords.push({
        id: `${point.ts}-failure-${ordinal}`,
        status: 'failure',
      })
    }
    records.unshift(...bucketRecords)

    if (records.length >= recordLimit) break
  }
  return records
}
