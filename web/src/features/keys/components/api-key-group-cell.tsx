import { Loader2 } from 'lucide-react'
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

import type { ApiKeyGroupOption } from './api-key-group-combobox'
import {
  // AutoGroupBadge,
  GroupRatioBadge,
  type GroupRatio,
} from './auto-group-visuals'
import { filterApiKeyGroupOptions } from '../lib/group-options'

const groupSelectContentClassName =
  'max-h-[min(20rem,var(--available-height))] min-w-[var(--anchor-width)] w-[440px] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain p-1.5'
const groupSelectItemClassName =
  'cursor-pointer items-center py-2.5 pr-10 pl-1.5 text-xs whitespace-normal hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground [&_[data-slot=select-item-text]]:min-w-0 [&_[data-slot=select-item-text]]:shrink [&_[data-slot=select-item-text]]:whitespace-normal'

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
        <StatusBadge label={t('Cross-group')} variant='info' copyable={false} />
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
  const selectableOptions = filterApiKeyGroupOptions(
    options.filter((option) => option.value !== 'default')
  )

  if (!props.onGroupChange || selectableOptions.length === 0) {
    return <ApiKeyGroupDisplay {...props} />
  }

  return (
    <Select
      items={selectableOptions.map((option) => ({
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
        className='border-input bg-muted/40 hover:border-ring hover:bg-muted data-popup-open:border-ring data-popup-open:bg-background data-popup-open:ring-ring/20 h-8 w-full min-w-0 cursor-pointer px-2.5 shadow-xs data-popup-open:ring-[3px] disabled:cursor-not-allowed'
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
          {selectableOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className={groupSelectItemClassName}
            >
              <span
                data-api-key-group-option-content='true'
                className='flex min-w-0 flex-1 items-center justify-between gap-4 whitespace-normal'
              >
                <span className='flex min-w-0 flex-1 flex-col items-start gap-1'>
                  <GroupBadge
                    group={option.value}
                    className='h-5 max-w-full px-1.5 text-[11px] leading-none [&>span]:overflow-visible [&>span]:text-clip [&>span]:whitespace-normal'
                  />
                  {option.desc && option.desc !== option.label && (
                    <span className='text-muted-foreground w-full pl-1.5 text-[11px] leading-snug break-words whitespace-normal'>
                      {option.desc}
                    </span>
                  )}
                </span>
                <span
                  data-api-key-group-option-ratio='true'
                  className='shrink-0 [&_[data-slot=badge]]:text-[10px]'
                >
                  <GroupRatioBadge
                    ratio={option.ratio}
                    isAuto={option.value === 'auto'}
                    shouldReduceMotion={props.shouldReduceMotion}
                  />
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
