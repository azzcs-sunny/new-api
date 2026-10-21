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

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { QuotaSettingsSection } from '../quota-settings-section'

async function renderSettings(selected: string[] = []) {
  function Fixture() {
    const [container, setContainer] = useState<HTMLDivElement | null>(null)
    return (
      <>
        <div ref={setContainer} />
        <SettingsPageProvider actionsContainer={container}>
          <QuotaSettingsSection
            defaultValues={{
              QuotaForNewUser: 0,
              QuotaForInviter: 0,
              QuotaForInvitee: 0,
              AffiliateRewardRatio: 0,
              TopUpLink: 'https://store.example.com',
              general_setting: { topup_link_groups: selected },
              quota_setting: {
                enable_free_model_pre_consume: true,
                trust_quota_usd: 10,
                pre_consume_multiplier: 1,
              },
            }}
          />
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
  const input = await screen.findByLabelText('Card-code purchase user groups')
  await waitFor(() => expect(input).toBeEnabled())
  return input
}

beforeEach(() => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: ['default', 'vip'] },
  })
  vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
})

test('starts with no groups selected and saves multiple selected groups', async () => {
  const user = userEvent.setup()
  const input = await renderSettings()
  expect(screen.queryByText('default')).not.toBeInTheDocument()
  expect(screen.queryByText('vip')).not.toBeInTheDocument()
  await user.click(input)
  await user.click(await screen.findByRole('option', { name: 'default' }))
  await user.click(await screen.findByRole('option', { name: 'vip' }))
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith('/api/option/', {
      key: 'general_setting.topup_link_groups',
      value: '["default","vip"]',
    })
  )
})

test('restores saved groups and saves an empty array when the selection is cleared', async () => {
  const user = userEvent.setup()
  const input = await renderSettings(['vip'])
  expect(screen.getByText('vip')).toBeInTheDocument()
  await user.click(input)
  await user.click(await screen.findByRole('option', { name: 'vip' }))
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith('/api/option/', {
      key: 'general_setting.topup_link_groups',
      value: '[]',
    })
  )
})
