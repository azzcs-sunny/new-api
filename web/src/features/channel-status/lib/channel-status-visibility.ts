/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { ChannelStatusRow } from '../types'

const mediaModelKeywords = [
  'image',
  'video',
  'dall-e',
  'dalle',
  'imagen',
  'flux',
  'stable-diffusion',
  'stable-image',
  'sdxl',
  'sd3',
  'midjourney',
  'cogview',
  'cogvideo',
  'seedance',
  'seedream',
  'jimeng',
  'kling',
  'vidu',
  'hailuo',
  'runway',
  'pika',
  'sora',
  'veo',
  'hunyuanvideo',
  'text-to-video',
  'image-to-video',
  'doubao-video',
] as const

const mediaModelPatterns = [
  /(?:^|[._-])wan(?:x?\d|[._-])/,
  /(?:^|[._-])(?:t2v|i2v|s2v)(?:$|[._-])/,
] as const

const hiddenChannelGroupKeywords = ['image', 'video', '图片', '视频'] as const

export function isMediaModel(modelName: string): boolean {
  const normalizedName = modelName.trim().toLowerCase()
  return (
    mediaModelKeywords.some((keyword) => normalizedName.includes(keyword)) ||
    mediaModelPatterns.some((pattern) => pattern.test(normalizedName))
  )
}

export function isHiddenChannelGroup(groupName: string): boolean {
  const normalizedName = groupName.trim().toLowerCase()
  return hiddenChannelGroupKeywords.some((keyword) =>
    normalizedName.includes(keyword)
  )
}

function isHiddenChannelStatusRow(row: ChannelStatusRow): boolean {
  return isMediaModel(row.model_name) || isHiddenChannelGroup(row.group)
}

export function filterVisibleChannelStatusRows(
  rows: readonly ChannelStatusRow[]
): ChannelStatusRow[] {
  return rows.filter((row) => !isHiddenChannelStatusRow(row))
}
