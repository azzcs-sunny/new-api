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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test } from 'vitest'

import { useSystemConfigStore } from '@/stores/system-config-store'

import { CommunityGroupButton } from '../community-group-button'

function Wrapper(props: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {props.children}
    </QueryClientProvider>
  )
}

beforeEach(() => {
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  useSystemConfigStore.getState().setConfig({
    qqGroupUrl: 'https://qm.qq.com/q/test-group',
    qqGroupName: 'Example QQ Group',
    qqGroupNumber: '123456789',
    telegramUrl: 'https://t.me/example_group',
    telegramName: 'Example Telegram Group',
  })
})

describe('CommunityGroupButton', () => {
  test('renders the QQ group link as an external link', () => {
    render(<CommunityGroupButton platform='qq' />, { wrapper: Wrapper })

    const link = screen.getByRole('button', { name: 'Join QQ Group' })
    expect(link).toHaveAttribute('href', 'https://qm.qq.com/q/test-group')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('shows the group details and QR code when the link is hovered', async () => {
    const user = userEvent.setup()
    render(<CommunityGroupButton platform='qq' />, { wrapper: Wrapper })

    await user.hover(screen.getByRole('button', { name: 'Join QQ Group' }))

    expect(await screen.findByText('Example QQ Group')).toBeVisible()
    expect(screen.getByText(/QQ Group Number: 123456789/)).toBeVisible()
    expect(screen.getByTitle('Join QQ Group').closest('svg')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Copy to clipboard' })
    ).toBeVisible()
  })

  test.each(['qq', 'telegram'] as const)(
    'hides %s when its link is missing, blank, or unsafe',
    (platform) => {
      const { container } = render(
        <CommunityGroupButton platform={platform} />,
        { wrapper: Wrapper }
      )
      for (const url of [
        undefined,
        '',
        '  ',
        'javascript:alert(1)',
        'https://user:secret@example.com',
      ]) {
        act(() =>
          useSystemConfigStore
            .getState()
            .setConfig({ qqGroupUrl: url, telegramUrl: url })
        )
        expect(container).toBeEmptyDOMElement()
      }
    }
  )

  test('shows Telegram details and regenerates its QR code when its link changes', async () => {
    const user = userEvent.setup()
    render(<CommunityGroupButton platform='telegram' />, { wrapper: Wrapper })
    const button = screen.getByRole('button', { name: 'Join Telegram' })
    expect(button).toHaveAttribute('href', 'https://t.me/example_group')
    expect(button).toHaveAttribute('rel', 'noopener noreferrer')
    await user.hover(button)
    expect(await screen.findByText('Example Telegram Group')).toBeVisible()
    const originalQR = screen
      .getByTitle('Join Telegram')
      .closest('svg')?.innerHTML
    expect(screen.queryByText(/QQ Group Number/)).not.toBeInTheDocument()
    act(() =>
      useSystemConfigStore
        .getState()
        .setConfig({ telegramUrl: 'https://t.me/another_group' })
    )
    expect(button).toHaveAttribute('href', 'https://t.me/another_group')
    expect(
      screen.getByTitle('Join Telegram').closest('svg')?.innerHTML
    ).not.toBe(originalQR)
    expect(screen.getByRole('link', { name: 'Join Telegram' })).toHaveAttribute(
      'href',
      'https://t.me/another_group'
    )
  })

  test('keeps Telegram visible when QQ is unconfigured', () => {
    useSystemConfigStore.getState().setConfig({ qqGroupUrl: '' })
    render(
      <>
        <CommunityGroupButton platform='qq' />
        <CommunityGroupButton platform='telegram' />
      </>,
      { wrapper: Wrapper }
    )
    expect(
      screen.queryByRole('button', { name: 'Join QQ Group' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join Telegram' })).toBeVisible()
  })

  test('shows the QQ QR code without empty group metadata or copy controls', async () => {
    useSystemConfigStore
      .getState()
      .setConfig({ qqGroupName: '', qqGroupNumber: '' })
    const user = userEvent.setup()
    render(<CommunityGroupButton platform='qq' />, { wrapper: Wrapper })
    await user.tab()
    expect(screen.getByRole('button', { name: 'Join QQ Group' })).toHaveFocus()
    await user.hover(screen.getByRole('button', { name: 'Join QQ Group' }))
    expect(await screen.findByTitle('Join QQ Group')).toBeInTheDocument()
    expect(screen.queryByText(/QQ Group Number/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Copy to clipboard' })
    ).not.toBeInTheDocument()
  })
})
