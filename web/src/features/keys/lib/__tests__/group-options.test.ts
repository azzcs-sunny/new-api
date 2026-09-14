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
})
