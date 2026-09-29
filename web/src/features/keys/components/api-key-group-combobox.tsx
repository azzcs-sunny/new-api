import type { ReactNode } from 'react'

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
import {
  CategorizedGroupSelector,
  type CategorizedGroupOption,
} from '@/components/categorized-group-selector'
import { GroupBadge } from '@/components/group-badge'
import { useMediaQuery } from '@/hooks'
import { cn } from '@/lib/utils'

import {
  AUTO_GROUP_FRAME_CLASS_NAME,
  AutoGroupFlowBorder,
  GroupRatioBadge,
} from './auto-group-visuals'

export type ApiKeyGroupOption = CategorizedGroupOption

type ApiKeyGroupComboboxProps = {
  options: ApiKeyGroupOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  hideDefaultOption?: boolean
  className?: string
  loading?: boolean
  'aria-label'?: string
  renderValue?: (option: ApiKeyGroupOption | undefined) => ReactNode
}

export function ApiKeyGroupCombobox({
  options,
  value,
  onValueChange,
  placeholder,
  disabled,
  hideDefaultOption = false,
  className,
  loading,
  'aria-label': ariaLabel,
  renderValue,
}: ApiKeyGroupComboboxProps) {
  const shouldReduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  return (
    <CategorizedGroupSelector
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      disabled={disabled}
      loading={loading}
      aria-label={ariaLabel}
      excludeValues={hideDefaultOption ? ['default'] : undefined}
      className={cn(
        'border-input bg-muted/40 hover:border-ring hover:bg-muted data-popup-open:border-ring data-popup-open:bg-background data-popup-open:ring-ring/20 relative text-start shadow-xs transition-[background-color,border-color,box-shadow] duration-150 data-popup-open:ring-[3px] disabled:cursor-not-allowed',
        value === 'auto' &&
          cn(
            AUTO_GROUP_FRAME_CLASS_NAME,
            'hover:border-primary/55 data-popup-open:border-primary/55 data-popup-open:ring-primary/20'
          ),
        className
      )}
      popupClassName='min-w-[var(--anchor-width)]'
      getTriggerAttributes={(selectedOption) => ({
        'data-auto-group-effect':
          selectedOption?.value === 'auto' ? 'trigger' : undefined,
      })}
      renderTriggerLeading={(selectedOption) =>
        selectedOption?.value === 'auto' ? (
          <AutoGroupFlowBorder shouldReduceMotion={shouldReduceMotion} />
        ) : null
      }
      renderValue={(selectedOption) => {
        if (renderValue) return renderValue(selectedOption)
        if (!selectedOption) return undefined
        return (
          <span className='flex min-w-0 flex-1 items-center justify-between gap-2'>
            <GroupBadge
              group={selectedOption.value}
              className='h-5 max-w-full px-1.5 text-[11px] leading-none'
            />
            <span className='shrink-0 [&_[data-slot=badge]]:text-[10px]'>
              <GroupRatioBadge
                ratio={selectedOption.ratio}
                isAuto={selectedOption.value === 'auto'}
                shouldReduceMotion={shouldReduceMotion}
              />
            </span>
          </span>
        )
      }}
      getOptionAttributes={(option) => ({
        'data-auto-group-effect':
          option.value === 'auto' ? 'option' : undefined,
      })}
      getOptionClassName={(option) =>
        option.value === 'auto' ? AUTO_GROUP_FRAME_CLASS_NAME : undefined
      }
      itemClassName='data-[auto-group-effect=option]:border-primary/35 data-[auto-group-effect=option]:hover:border-primary/55 data-[auto-group-effect=option]:data-selected:border-primary/55'
      renderOption={(option) => {
        const isAutoOption = option.value === 'auto'
        return (
          <>
            {isAutoOption && (
              <AutoGroupFlowBorder shouldReduceMotion={shouldReduceMotion} />
            )}
            <span
              data-api-key-group-option-content='true'
              className='flex min-w-0 flex-1 items-center justify-between gap-4 whitespace-normal'
            >
              <span className='flex min-w-0 flex-1 flex-col items-start gap-1'>
                <GroupBadge
                  group={option.value}
                  className='h-5 max-w-full px-1.5 text-[11px] leading-none [&>span]:overflow-visible [&>span]:text-clip [&>span]:whitespace-normal'
                />
                {option.desc && (
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
                  isAuto={isAutoOption}
                  shouldReduceMotion={shouldReduceMotion}
                />
              </span>
            </span>
          </>
        )
      }}
    />
  )
}
