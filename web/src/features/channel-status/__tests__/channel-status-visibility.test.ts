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
import { describe, expect, test } from 'vitest'

import {
  isHiddenChannelGroup,
  isMediaModel,
} from '../lib/channel-status-visibility'

describe('channel status group visibility', () => {
  test.each([
    'image',
    'video',
    'image-generation',
    'video-generation',
    'gpt-image-2',
    'grok-imagine-image-quality',
    'grok-imagine-video',
    'grok-imagine-video-1.5',
    '图片',
    '视频',
  ])('hides media group %s', (groupName) => {
    expect(isHiddenChannelGroup(groupName)).toBe(true)
  })

  test.each(['default', 'vip', 'text-generation', 'vision'])(
    'keeps non-media group %s visible',
    (groupName) => {
      expect(isHiddenChannelGroup(groupName)).toBe(false)
    }
  )

  test.each([
    'gpt-image-2',
    'grok-imagine-image-quality',
    'grok-imagine-video',
    'grok-imagine-video-1.5',
  ])('hides media model %s', (modelName) => {
    expect(isMediaModel(modelName)).toBe(true)
  })

  test.each(['gpt-5.6-sol', 'claude-sonnet', 'gemini-2.5-pro-vision'])(
    'keeps regular model %s visible',
    (modelName) => {
      expect(isMediaModel(modelName)).toBe(false)
    }
  )
})
