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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test } from 'vitest'

import {
  DEFAULT_THEME_CUSTOMIZATION,
  THEME_BASE_PRESET,
  THEME_COOKIE_KEYS,
} from '@/lib/theme-customization'

import {
  ThemeCustomizationProvider,
  useThemeCustomization,
} from '../theme-customization-provider'

function clearThemeCookies() {
  for (const value of Object.values(THEME_COOKIE_KEYS)) {
    document.cookie = `${value}=; path=/; max-age=0`
  }
}

function Harness() {
  const { customization, defaults, resetCustomization, setPreset } =
    useThemeCustomization()

  return (
    <div>
      <div data-testid='default-preset'>{defaults.preset}</div>
      <div data-testid='current-preset'>{customization.preset}</div>
      <button type='button' onClick={() => setPreset(THEME_BASE_PRESET)}>
        Base preset
      </button>
      <button type='button' onClick={() => setPreset('lavender-dream')}>
        Lavender preset
      </button>
      <button type='button' onClick={resetCustomization}>
        Reset preset
      </button>
    </div>
  )
}

afterEach(() => {
  clearThemeCookies()
  document.body.removeAttribute('data-theme-preset')
})

describe('ThemeCustomizationProvider', () => {
  test('uses the base preset as the default preset', () => {
    render(
      <ThemeCustomizationProvider>
        <Harness />
      </ThemeCustomizationProvider>
    )

    expect(screen.getByTestId('default-preset')).toHaveTextContent(
      DEFAULT_THEME_CUSTOMIZATION.preset
    )
    expect(screen.getByTestId('current-preset')).toHaveTextContent(
      DEFAULT_THEME_CUSTOMIZATION.preset
    )
    expect(document.body).not.toHaveAttribute('data-theme-preset')
    expect(document.cookie).not.toContain(`${THEME_COOKIE_KEYS.preset}=`)
  })

  test('resets a custom preset back to the base preset', async () => {
    const user = userEvent.setup()

    render(
      <ThemeCustomizationProvider>
        <Harness />
      </ThemeCustomizationProvider>
    )

    await user.click(screen.getByRole('button', { name: 'Lavender preset' }))
    expect(screen.getByTestId('current-preset')).toHaveTextContent(
      'lavender-dream'
    )
    expect(document.body).toHaveAttribute('data-theme-preset', 'lavender-dream')
    expect(document.cookie).toContain(
      `${THEME_COOKIE_KEYS.preset}=lavender-dream`
    )

    await user.click(screen.getByRole('button', { name: 'Reset preset' }))
    expect(screen.getByTestId('current-preset')).toHaveTextContent(
      DEFAULT_THEME_CUSTOMIZATION.preset
    )
    expect(document.body).not.toHaveAttribute('data-theme-preset')
    expect(document.cookie).not.toContain(`${THEME_COOKIE_KEYS.preset}=`)
  })
})
