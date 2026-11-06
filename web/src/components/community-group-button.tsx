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
import { SiQq, SiTelegram } from 'react-icons/si'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Separator } from '@/components/ui/separator'
import { useSystemConfig } from '@/hooks/use-system-config'
import { isCommunityLink } from '@/lib/community-link'
import { cn } from '@/lib/utils'

export function CommunityGroupButton(props: {
  platform: 'qq' | 'telegram'
  className?: string
}) {
  const { t } = useTranslation()
  const config = useSystemConfig()
  const { logo } = config
  const gradientId = `community-qr-gradient-${useId().replaceAll(':', '')}`
  const isQQ = props.platform === 'qq'
  const url = (isQQ ? config.qqGroupUrl : config.telegramUrl)?.trim() ?? ''
  const name = (isQQ ? config.qqGroupName : config.telegramName)?.trim()
  const number = isQQ ? config.qqGroupNumber?.trim() : ''
  const label = isQQ ? t('Join QQ Group') : t('Join Telegram')
  const Icon = isQQ ? SiQq : SiTelegram

  if (!url || !isCommunityLink(url)) return null

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={120}
        render={
          <Button
            size='sm'
            className={cn(
              'shrink-0 px-2 text-xs text-white sm:px-2.5',
              isQQ
                ? 'bg-[#12b7f5]! hover:bg-[#0da8e3]!'
                : 'bg-[#0088cc]! hover:bg-[#0077b5]!',
              props.className
            )}
            aria-label={label}
            nativeButton={false}
            render={<a href={url} target='_blank' rel='noopener noreferrer' />}
          />
        }
      >
        <Icon aria-hidden='true' data-icon='inline-start' />
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
            {name && (
              <p className='text-base font-semibold [overflow-wrap:anywhere] break-words'>
                {name}
              </p>
            )}
            {number && (
              <div className='text-background/65 flex items-center gap-1 text-sm'>
                <span className='min-w-0 [overflow-wrap:anywhere] break-words'>
                  {t('QQ Group Number')}: {number}
                </span>
                <CopyButton
                  value={number}
                  className='text-background/65 hover:bg-background/10 hover:text-background size-6'
                  iconClassName='size-3.5'
                  tooltip={t('Copy to clipboard')}
                  successTooltip={t('Copied!')}
                />
              </div>
            )}
          </div>
        </div>

        <Separator className='bg-background/15 my-3' />

        <a
          href={url}
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
            value={url}
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
