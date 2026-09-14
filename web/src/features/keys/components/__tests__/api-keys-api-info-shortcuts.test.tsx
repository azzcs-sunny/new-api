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
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { TooltipProvider } = await import('@/components/ui/tooltip')
const { ApiKeysApiInfoShortcutsView } = await import(
  '../api-keys-api-info-shortcuts'
)

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'Copy URL': 'Copy URL',
        'Test Latency': 'Test Latency',
        ms: 'ms',
      },
    },
  },
})

function renderShortcuts(
  props: Partial<Parameters<typeof ApiKeysApiInfoShortcutsView>[0]> = {}
) {
  const onTest = props.onTest ?? vi.fn()

  render(
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <ApiKeysApiInfoShortcutsView
          items={
            props.items ?? [
              {
                route: 'CF global proxy',
                description: 'Global node',
                url: 'https://api.example.com',
                color: 'blue',
              },
              {
                route: 'EU direct',
                description: 'Europe node',
                url: 'https://eu.example.com',
                color: 'green',
              },
            ]
          }
          pingStatus={props.pingStatus ?? {}}
          onTest={onTest}
        />
      </TooltipProvider>
    </I18nextProvider>
  )

  return { onTest }
}

describe('API key API info shortcuts', () => {
  test('renders every configured API route title with its copy action', () => {
    renderShortcuts()

    expect(screen.getByText('CF global proxy')).toBeInTheDocument()
    expect(screen.getByText('EU direct')).toBeInTheDocument()
    expect(screen.getByText('https://api.example.com')).toBeInTheDocument()
    expect(screen.getByText('https://eu.example.com')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Copy URL' })).toHaveLength(2)
  })

  test('tests latency for the selected API URL', () => {
    const { onTest } = renderShortcuts()

    fireEvent.click(screen.getAllByRole('button', { name: 'Test Latency' })[1])

    expect(onTest).toHaveBeenCalledWith('https://eu.example.com')
  })

  test('shows measured latency beside the matching API', () => {
    renderShortcuts({
      pingStatus: {
        'https://api.example.com': {
          latency: 124,
          testing: false,
          error: false,
        },
      },
    })

    expect(screen.getByText('124ms')).toBeInTheDocument()
  })
})
