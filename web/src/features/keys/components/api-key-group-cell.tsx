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
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { BadgeCell, TruncatedCell } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import {
  // AutoGroupBadge,
  GroupRatioBadge,
  type GroupRatio,
} from './auto-group-visuals'
import type { ApiKeyGroupOption } from './api-key-group-combobox'

const groupSelectContentClassName =
  'max-h-[min(20rem,var(--available-height))] w-[360px] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain p-1.5'
const groupSelectItemClassName =
  'items-start py-2.5 pr-9 pl-2.5 whitespace-normal [&_[data-slot=select-item-text]]:min-w-0 [&_[data-slot=select-item-text]]:shrink [&_[data-slot=select-item-text]]:whitespace-normal'

type ApiKeyGroupCellProps = {
  crossGroupRetry: boolean
  group: string
  isUpdating?: boolean
  onGroupChange?: (group: string) => void
  options?: ApiKeyGroupOption[]
  ratio?: GroupRatio
  shouldReduceMotion: boolean
}

type ApiKeyGroupDisplayProps = Pick<
  ApiKeyGroupCellProps,
  'crossGroupRetry' | 'group' | 'ratio' | 'shouldReduceMotion'
>

function ApiKeyGroupDisplay(props: ApiKeyGroupDisplayProps) {
  const { t } = useTranslation()

  if (props.group !== 'auto') {
    const ratio = typeof props.ratio === 'number' ? props.ratio : undefined
    return (
      <TruncatedCell
        className='-ml-1.5'
        tooltipContent={props.group || '-'}
        tooltipClassName='break-all'
      >
        <GroupBadge group={props.group} ratio={ratio} />
      </TruncatedCell>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <BadgeCell
            data-api-key-group-cell='auto'
            className='gap-1.5 overflow-visible text-xs'
          />
        }
      >
        <StatusBadge
          label={t('Cross-group')}
          variant='info'
          copyable={false}
        />
        {/*<AutoGroupBadge shouldReduceMotion={props.shouldReduceMotion} />*/}
        <GroupRatioBadge
          ratio={props.ratio}
          isAuto
          shouldReduceMotion={props.shouldReduceMotion}
        />
      </TooltipTrigger>
      <TooltipContent>
        <span className='text-xs'>
          {t(
            'Automatically selects the best available group with circuit breaker mechanism'
          )}
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

export function ApiKeyGroupCell(props: ApiKeyGroupCellProps) {
  const { t } = useTranslation()
  const options = props.options ?? []

  if (!props.onGroupChange || options.length === 0) {
    return <ApiKeyGroupDisplay {...props} />
  }

  return (
    <Select
      items={options.map((option) => ({
        label: option.label || t('User Group'),
        value: option.value,
      }))}
      value={props.group}
      onValueChange={(value) => {
        if (value !== null && value !== props.group) {
          props.onGroupChange?.(value)
        }
      }}
    >
      <SelectTrigger
        size='sm'
        aria-label={t('Group')}
        aria-busy={props.isUpdating}
        disabled={props.isUpdating}
        className='border-input bg-muted/40 hover:border-ring hover:bg-muted data-popup-open:border-ring data-popup-open:bg-background data-popup-open:ring-ring/20 h-8 max-w-full min-w-40 px-2.5 shadow-xs data-popup-open:ring-[3px]'
      >
        <SelectValue className='min-w-0'>
          <ApiKeyGroupDisplay {...props} />
        </SelectValue>
        {props.isUpdating && (
          <Loader2 aria-hidden='true' className='size-3.5 animate-spin' />
        )}
      </SelectTrigger>
      <SelectContent
        align='start'
        alignItemWithTrigger={false}
        className={groupSelectContentClassName}
      >
        <SelectGroup>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className={groupSelectItemClassName}
            >
              <span className='flex min-w-0 flex-1 flex-col items-start gap-1.5 whitespace-normal'>
                <GroupBadge
                  group={option.value}
                  ratio={
                    typeof option.ratio === 'number' ? option.ratio : undefined
                  }
                  className='h-auto min-h-5 shrink py-1 leading-snug whitespace-normal [&>span]:overflow-visible [&>span]:text-clip [&>span]:whitespace-normal'
                />
                {option.desc && option.desc !== option.label && (
                  <span className='text-muted-foreground w-full text-xs leading-relaxed break-words whitespace-normal'>
                    {option.desc}
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
