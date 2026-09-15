/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { ExternalLink, Info } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatNumber } from '@/lib/format'

import type { PaymentMethod } from '../types'

const CUSTOMER_SERVICE_QQ = '321479046'

interface TopupNoticeProps {
  topupGroupRatio: number
  topupLink?: string
  paymentMethods?: PaymentMethod[]
}

export function TopupNotice(props: TopupNoticeProps) {
  const { t } = useTranslation()
  const topupLink = props.topupLink?.trim()
  const paymentMethods = [
    ...new Set(
      (props.paymentMethods ?? [])
        .map((method) => method.name.trim())
        .filter(Boolean)
    ),
  ].join('/')
  const showOnlineFee =
    Number.isFinite(props.topupGroupRatio) &&
    props.topupGroupRatio > 1 &&
    paymentMethods.length > 0
  const feePercent = formatNumber((props.topupGroupRatio - 1) * 100)

  return (
    <Alert className='grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 px-4 py-4 sm:px-5'>
      <span
        className='border-info/20 bg-info/10 text-info row-span-2 flex size-8 shrink-0 items-center justify-center rounded-lg border'
        aria-hidden='true'
      >
        <Info className='size-4' />
      </span>
      <AlertTitle className='col-start-2'>
        {t('Top-up Instructions')}
      </AlertTitle>
      <AlertDescription className='col-start-2 text-pretty [&_p:not(:last-child)]:mb-1'>
        <p>
          {t(
            'For top-up assistance, contact customer service via QQ: {{qq}}.',
            {
              qq: CUSTOMER_SERVICE_QQ,
            }
          )}
        </p>
        {topupLink ? (
          <p>
            {t('Card-code store:')}{' '}
            <a
              href={topupLink}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary inline-flex max-w-full items-center gap-1 font-medium break-all'
            >
              {topupLink}
              <ExternalLink className='size-3 shrink-0' aria-hidden='true' />
            </a>
            <span>
              {' '}
              <Trans
                i18nKey='Card-code purchases have <fee>no service fee</fee>; <invoice>invoices are not supported</invoice>.'
                components={{
                  fee: <span className='text-destructive font-medium' />,
                  invoice: <span className='text-destructive font-medium' />,
                }}
              />
            </span>
          </p>
        ) : null}
        {showOnlineFee ? (
          <p>
            {t(
              'Online direct top-up via {{paymentMethods}} charges a {{feePercent}}% service fee | Online top-ups support ordinary VAT invoices.',
              { paymentMethods, feePercent }
            )}
          </p>
        ) : (
          <p>{t('Online top-ups support ordinary VAT invoices.')}</p>
        )}
      </AlertDescription>
    </Alert>
  )
}
