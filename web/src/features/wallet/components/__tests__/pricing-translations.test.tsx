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
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { describe, expect, test, vi } from 'vitest'

import zh from '@/i18n/locales/zh.json'

import { RechargeFormCard } from '../recharge-form-card'

describe('recharge preset pricing translations', () => {
  test('renders the discount and payment summary in Chinese', async () => {
    const i18n = createInstance()
    await i18n.use(initReactI18next).init({
      lng: 'zhCN',
      resources: { zhCN: zh },
    })

    render(
      <I18nextProvider i18n={i18n}>
        <RechargeFormCard
          topupInfo={{
            enable_online_topup: true,
            enable_stripe_topup: false,
            pay_methods: [],
            min_topup: 1,
            stripe_min_topup: 1,
            amount_options: [50],
            discount: { 50: 0.98 },
            enable_redemption: false,
          }}
          presetAmounts={[{ value: 50, discount: 0.98 }]}
          selectedPreset={50}
          onSelectPreset={vi.fn()}
          topupAmount={50}
          onTopupAmountChange={vi.fn()}
          paymentAmount={49}
          calculating={false}
          onPaymentMethodSelect={vi.fn()}
          paymentLoading={null}
          redemptionCode=''
          onRedemptionCodeChange={vi.fn()}
          onRedeem={vi.fn()}
          redeeming={false}
        />
      </I18nextProvider>
    )

    expect(screen.getByText('9.8折')).toBeInTheDocument()
    expect(screen.getByText(/实付 49/)).toBeInTheDocument()
    expect(screen.getByText(/省 1/)).toBeInTheDocument()
  })
})
