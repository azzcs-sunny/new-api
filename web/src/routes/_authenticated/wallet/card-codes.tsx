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
*/
import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Main } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTopupInfo } from '@/features/wallet/hooks/use-topup-info'

const CARD_CODES_SANDBOX = [
  'allow-downloads',
  'allow-forms',
  'allow-modals',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-presentation',
  'allow-same-origin',
  'allow-scripts',
  'allow-top-navigation-by-user-activation',
].join(' ')

const floatingOpenButtonClassName =
  'bg-background/95 text-foreground shadow-sm backdrop-blur hover:bg-muted dark:bg-background/90 dark:hover:bg-muted'

export const Route = createFileRoute('/_authenticated/wallet/card-codes')({
  component: CardCodesPage,
})

function CardCodesPage() {
  const { t } = useTranslation()
  const { topupInfo, loading } = useTopupInfo()
  const topupLink = topupInfo?.topup_link?.trim()

  if (!loading && !topupLink) {
    return (
      <Main className='items-center justify-center p-4'>
        <p className='text-muted-foreground text-sm'>
          {t('Top-up link is not configured')}
        </p>
      </Main>
    )
  }

  if (!topupLink) {
    return (
      <Main className='items-center justify-center p-4'>
        <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
      </Main>
    )
  }

  return (
    <Main className='relative p-2 sm:p-3'>
      <div className='border-border-base bg-background relative min-h-0 flex-1 overflow-hidden rounded-lg border'>
        <iframe
          src={topupLink}
          title={t('⭐Purchase Card Codes⭐')}
          className='h-full w-full border-0'
          allow='clipboard-read; clipboard-write'
          sandbox={CARD_CODES_SANDBOX}
        />
        <div className='absolute top-3 right-3 z-10'>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type='button'
                  size='icon-sm'
                  variant='outline'
                  className={floatingOpenButtonClassName}
                  aria-label={t('Open in new window')}
                  onClick={() => {
                    window.open(topupLink, '_blank', 'noopener,noreferrer')
                  }}
                >
                  <ExternalLink aria-hidden='true' />
                </Button>
              }
            />
            <TooltipContent>{t('Open in new window')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Main>
  )
}
