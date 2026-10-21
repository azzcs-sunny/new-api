/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { TopupNotice } from '../topup-notice'

describe('wallet top-up notice', () => {
  test.each([undefined, '', ' \t '])(
    'hides all top-up instructions when the group-filtered link is %j',
    (topupLink) => {
      const { container } = render(
        <TopupNotice
          topupGroupRatio={1.03}
          topupLink={topupLink}
          paymentMethods={[{ name: 'Alipay', type: 'alipay' }]}
        />
      )

      expect(container).toBeEmptyDOMElement()
    }
  )

  test('shows card-store invoice limits and online invoice support without a fee for rate 1', () => {
    render(
      <TopupNotice
        topupGroupRatio={1}
        topupLink='https://store.example.com/card-codes'
      />
    )

    expect(screen.getByText('Top-up Instructions')).toBeInTheDocument()
    expect(screen.getByText(/321479046/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'https://store.example.com/card-codes',
      })
    ).toHaveAttribute('href', 'https://store.example.com/card-codes')
    expect(screen.getByText('no service fee')).toHaveClass('text-destructive')
    expect(screen.getByText('invoices are not supported')).toHaveClass(
      'text-destructive'
    )
    expect(
      screen.getByText('Online top-ups support ordinary VAT invoices.')
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/WeChat\/Alipay charges a/)
    ).not.toBeInTheDocument()
  })

  test('converts the group multiplier to an online top-up fee percentage', () => {
    render(
      <TopupNotice
        topupGroupRatio={1.03}
        topupLink='https://store.example.com/card-codes'
        paymentMethods={[{ name: 'Alipay', type: 'alipay' }]}
      />
    )

    expect(
      screen.getByText(
        'Online direct top-up via Alipay charges a 3% service fee | Online top-ups support ordinary VAT invoices.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/WeChat/)).not.toBeInTheDocument()
  })

  test('hides previously visible instructions when the filtered link is removed', () => {
    const { container, rerender } = render(
      <TopupNotice
        topupGroupRatio={1}
        topupLink='https://store.example.com/card-codes'
      />
    )
    expect(screen.getByText('Top-up Instructions')).toBeInTheDocument()

    rerender(<TopupNotice topupGroupRatio={1} />)

    expect(container).toBeEmptyDOMElement()
  })
})
