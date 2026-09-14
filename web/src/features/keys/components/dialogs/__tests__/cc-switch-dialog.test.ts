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
import { beforeEach, describe, expect, test } from 'vitest'

import { buildCCSwitchURL } from '../cc-switch-dialog'

describe('CC Switch import URL', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(
      'status',
      JSON.stringify({ server_address: 'https://api.example.com' })
    )
  })

  test('uses the Grok Build app id and OpenAI-compatible endpoint for Grok', () => {
    const url = buildCCSwitchURL(
      'grokbuild',
      'My Grok',
      { model: 'grok-4.5' },
      'sk-test'
    )
    const params = new URL(url).searchParams

    expect(params.get('app')).toBe('grokbuild')
    expect(params.get('name')).toBe('My Grok')
    expect(params.get('endpoint')).toBe('https://api.example.com/v1')
    expect(params.get('model')).toBe('grok-4.5')
    expect(params.get('apiKey')).toBe('sk-test')
  })

  test('keeps Claude imports on the root endpoint', () => {
    const url = buildCCSwitchURL(
      'claude',
      'My Claude',
      { model: 'claude-sonnet-4-5' },
      'sk-test'
    )
    const params = new URL(url).searchParams

    expect(params.get('endpoint')).toBe('https://api.example.com')
  })
})
