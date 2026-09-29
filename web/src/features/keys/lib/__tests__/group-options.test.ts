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
import { describe, expect, test } from 'vitest'

import {
  getGroupCategories,
  getGroupCategory,
} from '@/components/categorized-group-selector/group-categories'

import { filterApiKeyGroupOptions, isUserGroupOption } from '../group-options'

describe('API key group option filtering', () => {
  test('filters empty and localized user group markers', () => {
    expect(isUserGroupOption({ value: '', label: 'User Group' })).toBe(true)
    expect(isUserGroupOption({ value: 'legacy', label: 'User Group' })).toBe(
      true
    )
    expect(isUserGroupOption({ value: 'legacy', label: 'User group' })).toBe(
      true
    )
    expect(isUserGroupOption({ value: 'legacy', label: '用户分组' })).toBe(true)
    expect(isUserGroupOption({ value: 'legacy', label: '用户组' })).toBe(true)
    expect(isUserGroupOption({ value: 'legacy', label: '用戶分組' })).toBe(true)
    expect(isUserGroupOption({ value: 'legacy', label: '用戶組' })).toBe(true)
    expect(
      isUserGroupOption({
        value: 'legacy',
        label: 'legacy',
        desc: '  User   Group  ',
      })
    ).toBe(true)
  })

  test('keeps regular token groups', () => {
    const filtered = filterApiKeyGroupOptions([
      { value: '', label: 'User Group' },
      { value: 'default', label: 'default', desc: 'Standard access' },
      { value: 'vip', label: 'vip', desc: 'Priority access' },
      { value: 'legacy', label: 'legacy', desc: '用户组' },
    ])

    expect(filtered).toEqual([
      { value: 'default', label: 'default', desc: 'Standard access' },
      { value: 'vip', label: 'vip', desc: 'Priority access' },
    ])
  })

  test.each([
    ['claude-team', 'Anthropic access', 'anthropic'],
    ['gpt-team', 'OpenAI access', 'openai'],
    ['qwen-team', '通义千问', 'domestic'],
    ['premium', 'Priority access', 'other'],
  ] as const)(
    'classifies %s from its name and description as %s',
    (value, desc, expectedCategory) => {
      expect(getGroupCategory({ value, label: value, desc })).toBe(
        expectedCategory
      )
    }
  )

  test('uses available models to categorize an advanced custom group', () => {
    expect(
      getGroupCategories({
        value: 'advanced-custom',
        label: 'Advanced custom',
        models: [
          'claude-sonnet-4',
          'text-embedding-3-small',
          'abab6.5s-chat',
          'gemini-2.5-pro',
        ],
      })
    ).toEqual(['anthropic', 'openai', 'domestic', 'other'])
  })
})
