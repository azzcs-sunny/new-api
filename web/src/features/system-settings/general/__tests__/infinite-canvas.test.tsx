/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License
as published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ComponentType } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { mapStatusDataToConfig } from '@/lib/status-query'
import { Route } from '@/routes/_authenticated/canvas'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { SystemInfoSection } from '../system-info-section'

const CanvasPage = Route.options.component as ComponentType
let savedLink = ''
let client: QueryClient

beforeEach(() => {
  savedLink = ''
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  vi.spyOn(api, 'get').mockImplementation(async () => ({
    data: { success: true, data: { infinite_canvas_url: savedLink } },
  }))
  vi.spyOn(api, 'put').mockImplementation(async (_url, request) => {
    const option = request as { key: string; value: string }
    if (option.key === 'general_setting.infinite_canvas_url') {
      savedLink = option.value
    }
    return { data: { success: true } }
  })
})

afterEach(() => {
  cleanup()
  client?.clear()
  window.localStorage.clear()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
})

async function renderSettings() {
  const defaults = {
    SystemName: 'New API',
    TaskPublicAddress: '',
    general_setting: { docs_link: '', infinite_canvas_url: savedLink },
    legal: {},
  }
  useSystemConfigStore
    .getState()
    .setConfig(mapStatusDataToConfig({ infinite_canvas_url: savedLink }))
  function Fixture() {
    const [container, setContainer] = useState<HTMLDivElement | null>(null)
    return (
      <>
        <CanvasPage />
        <div ref={setContainer} />
        <SettingsPageProvider actionsContainer={container}>
          <SystemInfoSection defaultValues={defaults} />
        </SettingsPageProvider>
      </>
    )
  }
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createRouter({
    routeTree: createRootRoute({ component: Fixture }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  await screen.findByLabelText('Infinite Canvas Link')
}

test('saving a link loads the configured canvas and clearing it removes the frame immediately', async () => {
  const user = userEvent.setup()
  await renderSettings()
  expect(screen.queryByTitle('Infinite Canvas')).not.toBeInTheDocument()
  const input = screen.getByLabelText('Infinite Canvas Link')
  await user.type(input, ' https://canvas.example.com/ ')
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(await screen.findByTitle('Infinite Canvas')).toHaveAttribute(
    'src',
    'https://canvas.example.com/'
  )
  expect(api.put).toHaveBeenCalledWith('/api/option/', {
    key: 'general_setting.infinite_canvas_url',
    value: 'https://canvas.example.com/',
  })
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
  )
  const open = vi.spyOn(window, 'open').mockImplementation(() => null)
  await user.click(screen.getByRole('button', { name: 'Open in new tab' }))
  expect(open).toHaveBeenCalledWith(
    'https://canvas.example.com/',
    '_blank',
    'noopener,noreferrer'
  )
  await user.clear(input)
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() =>
    expect(screen.queryByTitle('Infinite Canvas')).not.toBeInTheDocument()
  )
  expect(savedLink).toBe('')
})

test('an unsafe canvas link shows validation and is not saved', async () => {
  const user = userEvent.setup()
  await renderSettings()
  await user.type(
    screen.getByLabelText('Infinite Canvas Link'),
    'javascript:alert(1)'
  )
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(
    await screen.findByText('Enter a valid HTTP(S) link without credentials')
  ).toBeVisible()
  expect(api.put).not.toHaveBeenCalled()
  expect(screen.queryByTitle('Infinite Canvas')).not.toBeInTheDocument()
})
