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
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

let shouldReduceMotion = false
const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion)')
Object.defineProperty(reducedMotionMediaQuery, 'matches', {
  configurable: true,
  get: () => shouldReduceMotion,
})
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: () => reducedMotionMediaQuery,
})

function setReducedMotion(value: boolean) {
  shouldReduceMotion = value
  reducedMotionMediaQuery.dispatchEvent(new Event('change'))
}

const { useState } = await import('react')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { ApiKeyGroupCombobox } = await import('../api-key-group-combobox')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        Auto: 'Auto',
        Ratio: 'Ratio',
        'Search...': 'Search...',
        'No group found.': 'No group found.',
        'Select a group': 'Select a group',
        Vendor: 'Vendor',
        Anthropic: 'Anthropic',
        OpenAI: 'OpenAI',
        'Chinese Models': 'Chinese Models',
        Other: 'Other',
      },
    },
  },
})

const options = [
  {
    value: 'auto',
    label: 'auto',
    desc: 'Global automatic routing',
    ratio: '自动',
  },
  { value: 'default', label: 'default', desc: 'Standard group', ratio: 1 },
  { value: 'vip', label: 'vip', desc: 'Priority group', ratio: 3 },
  {
    value: 'openai-prod',
    label: 'openai-prod',
    desc: 'OpenAI production group',
    ratio: 2,
  },
  {
    value: 'claude-prod',
    label: 'claude-prod',
    desc: 'Claude production group',
    ratio: 2,
  },
  {
    value: 'qwen-prod',
    label: 'qwen-prod',
    desc: 'Qwen production group',
    ratio: 2,
  },
  {
    value: 'advanced-custom',
    label: 'advanced-custom',
    desc: 'Advanced custom group',
    ratio: 2,
    models: ['gpt-5', 'claude-sonnet-4'],
  },
  { value: 'legacy', label: 'legacy', desc: '用户分组', ratio: 1 },
]

function Harness(props: { initialValue: string; hideDefaultOption?: boolean }) {
  const [value, setValue] = useState(props.initialValue)

  return (
    <I18nextProvider i18n={i18n}>
      <ApiKeyGroupCombobox
        options={options}
        value={value}
        hideDefaultOption={props.hideDefaultOption}
        onValueChange={setValue}
      />
      <output data-testid='selected-group'>{value}</output>
    </I18nextProvider>
  )
}

function getTrigger(): HTMLButtonElement {
  return screen.getByRole('combobox')
}

function getCommandItem(label: string): HTMLElement {
  const item = [
    ...document.querySelectorAll<HTMLElement>('[data-slot="command-item"]'),
  ].find((candidate) => candidate.textContent?.includes(label))
  if (!item) {
    throw new Error(`Expected command item containing "${label}"`)
  }
  return item
}

describe('API key group combobox Auto effect', () => {
  test('uses the compact table capsules in the selected group and dropdown options', () => {
    setReducedMotion(false)
    render(<Harness initialValue='auto' />)

    const trigger = getTrigger()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('data-auto-group-effect', 'trigger')
    expect(trigger).toHaveClass('cursor-pointer', 'h-9')
    expect(trigger).not.toHaveClass('bg-linear-to-r', 'overflow-hidden')
    expect(trigger).toHaveClass('overflow-visible')

    const triggerFlowBorder = trigger.querySelector<HTMLElement>(
      '[data-auto-group-flow-border]'
    )
    expect(triggerFlowBorder).toHaveAttribute('aria-hidden', 'true')
    expect(triggerFlowBorder).toHaveClass(
      'pointer-events-none',
      'auto-group-flow-border'
    )

    const triggerRatio = trigger.querySelector('[data-slot="badge"]')
    expect(triggerRatio).toHaveTextContent('Auto')
    expect(triggerRatio).not.toHaveTextContent('Ratio')
    expect(triggerRatio).not.toHaveTextContent('x')
    expect(trigger).not.toHaveTextContent('自动')
    expect(triggerRatio).toHaveClass(
      'relative',
      'overflow-visible',
      'rounded-md',
      'h-5',
      'min-w-12'
    )
    expect(
      triggerRatio?.querySelector('[data-auto-group-flow-border]')
    ).toHaveClass('auto-group-flow-border-subtle')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const popup = document.querySelector<HTMLElement>(
      '[data-slot="popover-content"]'
    )
    expect(popup).toHaveClass(
      'min-w-[var(--anchor-width)]',
      'w-[480px]',
      'max-w-[calc(100vw-2rem)]',
      'overflow-hidden',
      'rounded-lg',
      'p-0'
    )
    expect(
      document.querySelector<HTMLElement>('[data-slot="command"]')
    ).toHaveClass('rounded-lg!', 'p-0')
    expect(
      document.querySelector<HTMLElement>('[data-slot="command-list"]')
    ).toHaveClass(
      'max-h-[min(17rem,var(--available-height))]',
      'overflow-y-auto',
      'overscroll-contain',
      'p-1.5'
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Other' }))
    const autoOption = getCommandItem('Global automatic routing')
    expect(autoOption).toHaveAttribute('data-auto-group-effect', 'option')
    expect(autoOption).toHaveAttribute('data-checked', 'true')
    expect(autoOption).not.toHaveClass('bg-linear-to-r')
    expect(autoOption).toHaveClass(
      'cursor-pointer',
      'hover:bg-accent',
      'data-selected:bg-accent',
      'overflow-visible'
    )
    expect(
      autoOption.querySelector('[data-auto-group-flow-border]')
    ).toBeInTheDocument()
    const optionRatio = autoOption.querySelector('[data-slot="badge"]')
    expect(optionRatio).toHaveTextContent('Auto')
    expect(optionRatio).not.toHaveTextContent('Ratio')
    expect(
      optionRatio?.querySelector('[data-auto-group-flow-border]')
    ).toHaveClass('auto-group-flow-border-subtle')

    const defaultOption = getCommandItem('Standard group')
    expect(defaultOption).not.toHaveAttribute('data-auto-group-effect')
    expect(defaultOption.querySelector('[data-auto-group-flow-border]')).toBe(
      null
    )
    const defaultRatio = within(defaultOption)
      .getByText('1x')
      .closest('[data-slot="badge"]')
    expect(defaultRatio).toHaveClass(
      'h-5',
      'min-w-12',
      'rounded-full',
      'tabular-nums',
      'border-muted-foreground/30'
    )
    expect(defaultRatio).not.toHaveTextContent('Ratio')
    expect(
      defaultOption.querySelector('[data-auto-group-effect="ratio"]')
    ).toBe(null)
  })

  test('keeps search and selection behavior while leaving normal groups unstyled', async () => {
    setReducedMotion(false)
    const { container } = render(<Harness initialValue='auto' />)

    const trigger = getTrigger()
    fireEvent.click(trigger)

    fireEvent.input(screen.getByPlaceholderText('Search...'), {
      target: { value: 'vip' },
    })

    const visibleOptions = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="command-item"]'),
    ]
    expect(
      visibleOptions.some((option) =>
        option.textContent?.includes('Global automatic routing')
      )
    ).toBe(false)
    const vipOption = getCommandItem('Priority group')
    fireEvent.click(vipOption)

    expect(within(container).getByTestId('selected-group')).toHaveTextContent(
      'vip'
    )
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).not.toHaveAttribute('data-auto-group-effect')
    expect(trigger.querySelector('[data-auto-group-flow-border]')).toBe(null)
  })

  test('can hide the default group from selectable options while preserving the current value', () => {
    setReducedMotion(false)
    render(<Harness initialValue='default' hideDefaultOption />)

    const trigger = getTrigger()
    expect(trigger).toHaveTextContent('default')

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('tab', { name: 'Other' }))
    expect(() => getCommandItem('Standard group')).toThrow(
      'Expected command item containing "Standard group"'
    )
    expect(getCommandItem('Priority group')).toBeInTheDocument()
  })

  test('filters user-group-only options from the selectable list', () => {
    setReducedMotion(false)
    render(<Harness initialValue='vip' />)

    fireEvent.click(getTrigger())
    fireEvent.click(screen.getByRole('tab', { name: 'Other' }))

    expect(() => getCommandItem('用户分组')).toThrow(
      'Expected command item containing "用户分组"'
    )
    expect(getCommandItem('Priority group')).toBeInTheDocument()
  })

  test('preserves the static Auto treatment but omits moving layers for reduced motion', async () => {
    setReducedMotion(true)
    render(<Harness initialValue='auto' />)

    const trigger = getTrigger()
    expect(trigger).toHaveAttribute('data-auto-group-effect', 'trigger')
    expect(trigger.querySelector('[data-auto-group-flow-border]')).toBe(null)
    expect(within(trigger).getAllByText('Auto')).toHaveLength(2)

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('tab', { name: 'Other' }))
    const autoOption = getCommandItem('Global automatic routing')
    expect(autoOption).toHaveAttribute('data-auto-group-effect', 'option')
    expect(autoOption.querySelector('[data-auto-group-flow-border]')).toBe(null)
    expect(within(autoOption).getAllByText('Auto')).toHaveLength(2)
    setReducedMotion(false)
  })

  test('defaults to OpenAI and reveals each provider category separately', () => {
    setReducedMotion(false)
    render(<Harness initialValue='' />)

    fireEvent.click(getTrigger())

    expect(screen.getByRole('tab', { name: 'OpenAI' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(getCommandItem('OpenAI production group')).toBeInTheDocument()
    expect(getCommandItem('Advanced custom group')).toBeInTheDocument()
    expect(() => getCommandItem('Claude production group')).toThrow()

    fireEvent.click(screen.getByRole('tab', { name: 'Anthropic' }))
    expect(getCommandItem('Claude production group')).toBeInTheDocument()
    expect(getCommandItem('Advanced custom group')).toBeInTheDocument()
    expect(() => getCommandItem('OpenAI production group')).toThrow()

    fireEvent.click(screen.getByRole('tab', { name: 'Chinese Models' }))
    expect(getCommandItem('Qwen production group')).toBeInTheDocument()
  })
})
