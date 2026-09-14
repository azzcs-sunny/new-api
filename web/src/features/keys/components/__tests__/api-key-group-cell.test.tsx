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
import { describe, expect, test, vi } from 'vitest'

import type { ApiKeyGroupOption } from '../api-key-group-combobox'

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { TooltipProvider } = await import('@/components/ui/tooltip')
const { ApiKeyGroupCell } = await import('../api-key-group-cell')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        Auto: 'Auto',
        'Cross-group': 'Cross-group',
        Ratio: 'Ratio',
        Group: 'Group',
        'User Group': 'User Group',
        'Automatically selects the best available group with circuit breaker mechanism':
          'Automatically selects the best available group with circuit breaker mechanism',
      },
    },
  },
})

function CellHarness(props: {
  group: string
  ratio?: number | string
  crossGroupRetry?: boolean
  isUpdating?: boolean
  onGroupChange?: (group: string) => void
  options?: ApiKeyGroupOption[]
  shouldReduceMotion?: boolean
}) {
  return (
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <ApiKeyGroupCell
          group={props.group}
          ratio={props.ratio}
          crossGroupRetry={props.crossGroupRetry ?? false}
          isUpdating={props.isUpdating}
          onGroupChange={props.onGroupChange}
          options={props.options}
          shouldReduceMotion={props.shouldReduceMotion ?? false}
        />
      </TooltipProvider>
    </I18nextProvider>
  )
}

describe('API key group table cell', () => {
  test('renders an unclipped ring and a localized Auto ratio when API data uses a nonlocalized string', () => {
    const { container } = render(
      <CellHarness
        group='auto'
        ratio='自动'
        crossGroupRetry
        shouldReduceMotion={false}
      />
    )

    const badgeCell = container.querySelector<HTMLElement>(
      '[data-api-key-group-cell="auto"]'
    )
    expect(badgeCell).toHaveClass('overflow-visible')
    expect(badgeCell).not.toHaveClass('overflow-hidden')

    const frames = container.querySelectorAll('[data-auto-group-frame]')
    const movingRings = container.querySelectorAll(
      '[data-auto-group-flow-border]'
    )
    expect(frames.length).toBe(1)
    expect(movingRings.length).toBe(1)
    for (const frame of frames) {
      expect(frame).toHaveClass(
        'relative',
        'overflow-visible',
        'rounded-4xl',
        'p-px'
      )
    }

    const ratio = container.querySelector<HTMLElement>(
      '[data-auto-group-effect="ratio"]'
    )
    expect(ratio).toHaveTextContent('Auto Ratio')
    expect(ratio).not.toHaveTextContent('x')
    expect(container).not.toHaveTextContent('自动')
    expect(container).toHaveTextContent('Cross-group')

    const crossGroupBadge = [
      ...container.querySelectorAll<HTMLElement>('[data-slot="status-badge"]'),
    ].find((badge) => badge.textContent === 'Cross-group')
    expect(crossGroupBadge).not.toBeUndefined()
    expect(crossGroupBadge?.closest('[data-auto-group-frame]')).toBeNull()
  })

  test('keeps the static Auto ratio frame but omits its moving layer for reduced motion', () => {
    const { container } = render(
      <CellHarness group='auto' ratio='Auto' shouldReduceMotion />
    )

    expect(container.querySelectorAll('[data-auto-group-frame]').length).toBe(1)
    expect(
      container.querySelectorAll('[data-auto-group-flow-border]').length
    ).toBe(0)
  })

  test('shows only the cross-group badge when ratio data is unavailable', () => {
    const { container } = render(
      <CellHarness group='auto' shouldReduceMotion={false} />
    )

    expect(container.querySelectorAll('[data-auto-group-frame]').length).toBe(0)
    expect(
      container.querySelectorAll('[data-auto-group-flow-border]').length
    ).toBe(0)
    expect(container.querySelector('[data-auto-group-effect="ratio"]')).toBe(
      null
    )
    expect(container).toHaveTextContent('Cross-group')
    expect(container).not.toHaveTextContent('Auto')
    expect(container).not.toHaveTextContent('Ratio')
  })

  test('narrows normal group ratios to numbers and never applies Auto rings', () => {
    const { container, rerender } = render(
      <CellHarness group='vip' ratio='自动' shouldReduceMotion={false} />
    )

    expect(container).toHaveTextContent('vip')
    expect(container).not.toHaveTextContent('自动')
    expect(container.querySelector('[data-auto-group-frame]')).toBe(null)
    expect(container.querySelector('[data-auto-group-flow-border]')).toBe(null)

    rerender(<CellHarness group='vip' ratio={3} shouldReduceMotion={false} />)

    expect(container).toHaveTextContent('3x')
    expect(container.querySelector('[data-auto-group-frame]')).toBe(null)
  })

  test('opens a compact group selector and reports the selected group', async () => {
    const user = userEvent.setup()
    const onGroupChange = vi.fn()
    const options: ApiKeyGroupOption[] = [
      { value: 'default', label: 'default', ratio: 1 },
      { value: 'vip', label: 'vip', desc: 'Priority group', ratio: 3 },
    ]

    render(
      <CellHarness
        group='default'
        ratio={1}
        options={options}
        onGroupChange={onGroupChange}
      />
    )

    const trigger = screen.getByRole('combobox', { name: 'Group' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveClass('border-input', 'bg-muted/40', 'cursor-pointer')

    await user.click(trigger)
    const vipOption = await screen.findByRole('option', { name: /vip/i })
    expect(screen.queryByRole('option', { name: /default/i })).toBeNull()
    const popup = document.querySelector<HTMLElement>(
      '[data-slot="select-content"]'
    )
    expect(popup).toHaveClass(
      'max-h-[min(20rem,var(--available-height))]',
      'min-w-[var(--anchor-width)]',
      'w-[440px]',
      'max-w-[calc(100vw-2rem)]',
      'overflow-y-auto',
      'overscroll-contain',
      'p-1.5'
    )
    expect(vipOption).toHaveClass(
      'cursor-pointer',
      'hover:bg-accent',
      'hover:text-accent-foreground',
      'whitespace-normal',
      'py-2.5',
      'pl-1.5',
      'text-xs'
    )
    expect(
      vipOption.querySelector('[data-api-key-group-option-content]')
    ).toHaveClass('justify-between', 'gap-4')
    expect(
      vipOption.querySelector('[data-api-key-group-option-ratio]')
    ).toHaveClass('shrink-0')
    expect(vipOption).toHaveTextContent('3x Ratio')
    expect(screen.getByText('Priority group')).toHaveClass(
      'w-full',
      'pl-1.5',
      'break-words',
      'whitespace-normal'
    )
    expect(screen.getByText('Priority group')).not.toHaveClass('truncate')
    await user.click(vipOption)

    expect(onGroupChange).toHaveBeenCalledOnce()
    expect(onGroupChange).toHaveBeenCalledWith('vip')
  })

  test('uses the available group column width for the selected group label', () => {
    render(
      <CellHarness
        group='GPT-PLUS'
        ratio={0.14}
        options={[
          { value: 'default', label: 'default', ratio: 1 },
          { value: 'GPT-PLUS', label: 'GPT-PLUS', ratio: 0.14 },
        ]}
        onGroupChange={vi.fn()}
      />
    )

    const trigger = screen.getByRole('combobox', { name: 'Group' })
    expect(trigger).toHaveClass('w-full', 'min-w-0')
    expect(trigger).not.toHaveClass('w-fit', 'min-w-40')
    expect(screen.getByText('GPT-PLUS')).toBeVisible()
    expect(screen.getByText('0.14x')).toBeVisible()
  })

  test('disables the group selector while an update is pending', () => {
    render(
      <CellHarness
        group='default'
        isUpdating
        options={[
          { value: 'default', label: 'default', ratio: 1 },
          { value: 'vip', label: 'vip', ratio: 3 },
        ]}
        onGroupChange={vi.fn()}
      />
    )

    const trigger = screen.getByRole('combobox', { name: 'Group' })
    expect(trigger).toBeDisabled()
    expect(trigger).toHaveAttribute('aria-busy', 'true')
  })

  test('filters empty user group values from the selector', async () => {
    const user = userEvent.setup()
    const onGroupChange = vi.fn()

    render(
      <CellHarness
        group='vip'
        options={[
          { value: '', label: '', ratio: 1 },
          { value: 'vip', label: 'vip', ratio: 3 },
        ]}
        onGroupChange={onGroupChange}
      />
    )

    await user.click(screen.getByRole('combobox', { name: 'Group' }))
    expect(screen.queryByRole('option', { name: /User Group/i })).toBeNull()
    await user.click(await screen.findByRole('option', { name: /vip/i }))

    expect(onGroupChange).not.toHaveBeenCalled()
  })
})
