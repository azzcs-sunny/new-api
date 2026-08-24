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
import { QRCodeSVG } from 'qrcode.react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { SiQq } from 'react-icons/si'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Separator } from '@/components/ui/separator'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

const QQ_GROUP_URL = 'https://qm.qq.com/q/FSYcQbGngA'
const QQ_GROUP_NAME = 'WC API'
const QQ_GROUP_NUMBER = '907379317'

export function QqGroupButton(props: { className?: string }) {
  const { t } = useTranslation()
  const { logo } = useSystemConfig()
  const gradientId = `qq-qr-gradient-${useId().replaceAll(':', '')}`
  const label = t('Join QQ Group')

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={120}
        render={
          <Button
            size='sm'
            className={cn(
              'bg-[#12b7f5]! px-2 text-xs text-white hover:bg-[#0da8e3]! sm:px-2.5',
              props.className
            )}
            aria-label={label}
            nativeButton={false}
            render={
              <a
                href={QQ_GROUP_URL}
                target='_blank'
                rel='noopener noreferrer'
              />
            }
          />
        }
      >
        <SiQq aria-hidden='true' data-icon='inline-start' />
        <span className='hidden sm:inline'>{label}</span>
      </HoverCardTrigger>

      <HoverCardContent
        align='end'
        sideOffset={8}
        className='bg-foreground text-background w-[min(20rem,calc(100vw-1rem))] p-4 shadow-xl'
      >
        <div className='flex items-center gap-3'>
          <img
            src={logo}
            alt=''
            aria-hidden='true'
            className='size-12 shrink-0 rounded-full bg-white object-cover ring-2 ring-white/20'
          />
          <div className='min-w-0 flex-1'>
            <p className='truncate text-base font-semibold'>{QQ_GROUP_NAME}</p>
            <div className='text-background/65 flex items-center gap-1 text-sm'>
              <span>
                {t('QQ Group Number')}: {QQ_GROUP_NUMBER}
              </span>
              <CopyButton
                value={QQ_GROUP_NUMBER}
                className='text-background/65 hover:bg-background/10 hover:text-background size-6'
                iconClassName='size-3.5'
                tooltip={t('Copy to clipboard')}
                successTooltip={t('Copied!')}
              />
            </div>
          </div>
        </div>

        <Separator className='bg-background/15 my-3' />

        <a
          href={QQ_GROUP_URL}
          target='_blank'
          rel='noopener noreferrer'
          aria-label={label}
          className='focus-visible:ring-background/60 flex justify-center rounded-md outline-none focus-visible:ring-2'
        >
          <svg
            aria-hidden='true'
            className='pointer-events-none absolute size-0'
          >
            <defs>
              <linearGradient
                id={gradientId}
                x1='0%'
                y1='0%'
                x2='100%'
                y2='100%'
              >
                <stop offset='0%' stopColor='#49d9e8' />
                <stop offset='52%' stopColor='#61b9f2' />
                <stop offset='100%' stopColor='#b49af3' />
              </linearGradient>
            </defs>
          </svg>
          <QRCodeSVG
            value={QQ_GROUP_URL}
            level='H'
            marginSize={1}
            bgColor='transparent'
            fgColor={`url(#${gradientId})`}
            title={label}
            shapeRendering='crispEdges'
            className='h-auto w-[18rem] max-w-full'
            imageSettings={{
              src: logo,
              width: 42,
              height: 42,
              excavate: true,
            }}
          />
        </a>

        <p className='text-background/75 mt-2 text-center text-sm'>
          {t('Scan the QR code to join the group')}
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}
