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

const INFINITE_CANVAS_SANDBOX = [
  'allow-downloads',
  'allow-forms',
  'allow-modals',
  'allow-popups',
  'allow-presentation',
  'allow-same-origin',
  'allow-scripts',
].join(' ')

export const Route = createFileRoute('/_authenticated/canvas/')({
  component: InfiniteCanvasPage,
})

function InfiniteCanvasPage() {
  const { t } = useTranslation()
  const canvasUrl = import.meta.env.VITE_INFINITE_CANVAS_URL

  if (!canvasUrl) {
    return (
      <Main className='items-center justify-center'>
        <p>{t('Infinite Canvas')}</p>
      </Main>
    )
  }

  return (
    <Main className='relative p-2 sm:p-3'>
      <div className='relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border-base bg-background'>
        <iframe
          src={canvasUrl}
          title={t('Infinite Canvas')}
          className='h-full w-full border-0'
          allow='clipboard-read; clipboard-write'
          sandbox={INFINITE_CANVAS_SANDBOX}
        />
        <div className='absolute top-3 right-3 z-10'>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type='button'
                  size='icon-sm'
                  variant='outline'
                  aria-label={t('Open in new tab')}
                  onClick={() => {
                    window.open(canvasUrl, '_blank', 'noopener,noreferrer')
                  }}
                >
                  <ExternalLink aria-hidden='true' />
                </Button>
              }
            />
            <TooltipContent>{t('Open in new tab')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Main>
  )
}
