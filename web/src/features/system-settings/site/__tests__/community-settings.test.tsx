/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { CommunityGroupButton } from '@/components/community-group-button'
import { api } from '@/lib/api'
import { mapStatusDataToConfig } from '@/lib/status-query'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { CommunitySettingsSection } from '../community-settings-section'

let saved = {
  qq_group_url: '',
  qq_group_name: '',
  qq_group_number: '',
  telegram_url: '',
  telegram_name: '',
  customer_service_qq: '',
}

beforeEach(() => {
  saved = {
    qq_group_url: '',
    qq_group_name: '',
    qq_group_number: '',
    telegram_url: '',
    telegram_name: '',
    customer_service_qq: '',
  }
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  vi.spyOn(api, 'get').mockImplementation(async () => ({
    data: { success: true, data: { ...saved } },
  }))
  vi.spyOn(api, 'put').mockImplementation(async (_url, request) => {
    const option = request as { key: string; value: string }
    saved[option.key.replace('general_setting.', '') as keyof typeof saved] =
      option.value
    return { data: { success: true } }
  })
})

async function renderSettings() {
  const defaults = { general_setting: { ...saved } }
  useSystemConfigStore.getState().setConfig(mapStatusDataToConfig(saved))
  function Fixture() {
    const [container, setContainer] = useState<HTMLDivElement | null>(null)
    return (
      <>
        <CommunityGroupButton platform='qq' />
        <CommunityGroupButton platform='telegram' />
        <div ref={setContainer} />
        <SettingsPageProvider actionsContainer={container}>
          <CommunitySettingsSection defaultValues={defaults} />
        </SettingsPageProvider>
      </>
    )
  }
  const client = new QueryClient({
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
  await screen.findByLabelText('QQ Group Link')
}

test('saves community fields and refreshes header buttons without reloading the page', async () => {
  const user = userEvent.setup()
  await renderSettings()
  expect(
    screen.queryByRole('button', { name: 'Join QQ Group' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Join Telegram' })
  ).not.toBeInTheDocument()
  for (const [label, value] of [
    ['QQ Group Link', 'https://qm.qq.com/q/example'],
    ['QQ Group Name', 'Example QQ'],
    ['QQ Group Number', '123456789'],
    ['Telegram Link', 'https://t.me/example'],
    ['Telegram Name', 'Example Telegram'],
    ['Wallet Customer Service QQ', '987654321'],
  ]) {
    await user.type(screen.getByLabelText(label), value)
  }
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() =>
    expect(saved).toEqual({
      qq_group_url: 'https://qm.qq.com/q/example',
      qq_group_name: 'Example QQ',
      qq_group_number: '123456789',
      telegram_url: 'https://t.me/example',
      telegram_name: 'Example Telegram',
      customer_service_qq: '987654321',
    })
  )
  expect(screen.getByRole('button', { name: 'Join QQ Group' })).toHaveAttribute(
    'href',
    saved.qq_group_url
  )
  expect(screen.getByRole('button', { name: 'Join Telegram' })).toHaveAttribute(
    'href',
    saved.telegram_url
  )
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
  )
  expect(useSystemConfigStore.getState().config.customerServiceQQ).toBe(
    '987654321'
  )
})

test('clearing existing links hides both header buttons immediately after saving', async () => {
  saved.qq_group_url = 'https://qm.qq.com/q/example'
  saved.telegram_url = 'https://t.me/example'
  const user = userEvent.setup()
  await renderSettings()
  expect(screen.getByRole('button', { name: 'Join QQ Group' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Join Telegram' })).toBeVisible()
  await user.clear(screen.getByLabelText('QQ Group Link'))
  await user.clear(screen.getByLabelText('Telegram Link'))
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() => {
    expect(
      screen.queryByRole('button', { name: 'Join QQ Group' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Join Telegram' })
    ).not.toBeInTheDocument()
  })
})

test('rejects unsafe links before sending settings to the server', async () => {
  const user = userEvent.setup()
  await renderSettings()
  await user.type(screen.getByLabelText('Telegram Link'), 'javascript:alert(1)')
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(
    await screen.findByText('Enter a valid HTTP(S) link without credentials')
  ).toBeVisible()
  expect(api.put).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Telegram Link')).toHaveAttribute(
    'aria-invalid',
    'true'
  )
})
