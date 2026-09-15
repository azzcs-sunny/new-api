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
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type PluginModelListProps = {
  models: string[]
  collapsedLabel?: string
  popoverTitle?: string
  maxVisible?: number
}

/** Model lists remain available to touch and keyboard users, even on narrow screens. */
export function PluginModelList(props: PluginModelListProps) {
  const { t } = useTranslation()
  if (props.collapsedLabel) {
    const popoverTitle = props.popoverTitle ?? props.collapsedLabel
    const accessibleLabel = props.popoverTitle
      ? `${popoverTitle} (${props.models.length})`
      : props.collapsedLabel
    return (
      <Popover>
        <PopoverTrigger
          render={
            <Button variant='outline' size='xs' aria-label={accessibleLabel} />
          }
        >
          {props.collapsedLabel}
        </PopoverTrigger>
        <PopoverContent
          aria-label={accessibleLabel}
          className='w-80 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0'
        >
          <div className='flex items-center justify-between gap-2 border-b px-3 py-2'>
            <div className='min-w-0'>
              <p className='truncate text-sm font-medium'>{popoverTitle}</p>
              <p className='text-muted-foreground text-xs'>
                {props.models.length} {t('models')}
              </p>
            </div>
            <CopyButton
              value={props.models.join('\n')}
              className='size-7'
              iconClassName='size-3.5'
              tooltip={t('Copy model names')}
              successTooltip={t('Copied!')}
              aria-label={t('Copy model names')}
            />
          </div>
          <div
            data-testid='model-list-scroll-area'
            className='max-h-64 overflow-y-auto overscroll-contain p-1.5'
          >
            <ul className='divide-y font-mono text-xs'>
              {props.models.map((model) => (
                <li
                  key={model}
                  className='hover:bg-muted/60 flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5'
                >
                  <span className='min-w-0 flex-1 break-all select-text'>
                    {model}
                  </span>
                  <CopyButton
                    value={model}
                    className='size-7'
                    iconClassName='size-3.5'
                    tooltip={t('Copy model name')}
                    successTooltip={t('Copied!')}
                    aria-label={`${t('Copy model name')}: ${model}`}
                  />
                </li>
              ))}
            </ul>
          </div>
        </PopoverContent>
      </Popover>
    )
  }
  const visible = props.models.slice(0, props.maxVisible ?? 6)
  const hidden = props.models.slice(props.maxVisible ?? 6)
  return (
    <div className='min-w-0 space-y-2'>
      {visible.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {visible.map((model) => (
            <Badge
              key={model}
              variant='secondary'
              className='h-auto max-w-full rounded-md font-mono font-normal break-all whitespace-normal'
            >
              {model}
            </Badge>
          ))}
        </div>
      )}
      {hidden.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger
            render={
              <Button
                variant='ghost'
                size='sm'
                className='h-auto max-w-full gap-1 px-1 py-1 text-xs whitespace-normal'
              />
            }
          >
            {props.collapsedLabel ??
              t('More models ({{count}})', { count: hidden.length })}
            <ChevronDown className='size-3 shrink-0' aria-hidden='true' />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className='flex flex-wrap gap-1.5 pt-2'>
              {hidden.map((model) => (
                <Badge
                  key={model}
                  variant='secondary'
                  className='h-auto max-w-full rounded-md font-mono font-normal break-all whitespace-normal'
                >
                  {model}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
