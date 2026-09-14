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
import { ChevronsUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GroupBadge } from '@/components/group-badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useMediaQuery } from '@/hooks'
import { cn } from '@/lib/utils'

import { filterApiKeyGroupOptions } from '../lib/group-options'
import {
  AUTO_GROUP_FRAME_CLASS_NAME,
  AutoGroupFlowBorder,
  GroupRatioBadge,
} from './auto-group-visuals'

export type ApiKeyGroupOption = {
  value: string
  label: string
  desc?: string
  ratio?: number | string
}

const groupComboboxContentClassName =
  'max-h-[min(20rem,var(--available-height))] min-w-[var(--anchor-width)] w-[440px] max-w-[calc(100vw-2rem)] overflow-hidden overscroll-contain rounded-lg p-0 shadow-lg'
const groupComboboxListClassName =
  'max-h-[min(20rem,var(--available-height))] overflow-y-auto overscroll-contain p-1.5'
const groupComboboxItemClassName =
  'cursor-pointer items-center gap-1.5 rounded-md py-2.5 pr-1.5 pl-1.5 text-xs whitespace-normal transition-colors hover:bg-accent hover:text-accent-foreground data-selected:bg-accent data-selected:text-accent-foreground'

type ApiKeyGroupComboboxProps = {
  options: ApiKeyGroupOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  hideDefaultOption?: boolean
}

export function ApiKeyGroupCombobox({
  options,
  value,
  onValueChange,
  placeholder,
  disabled,
  hideDefaultOption = false,
}: ApiKeyGroupComboboxProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const shouldReduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const selectedOption = options.find((option) => option.value === value)
  const isAutoSelected = selectedOption?.value === 'auto'

  const filteredOptions = useMemo(() => {
    const search = searchValue.trim().toLowerCase()
    const selectableOptions = filterApiKeyGroupOptions(
      hideDefaultOption
        ? options.filter((option) => option.value !== 'default')
        : options
    )
    if (!search) return selectableOptions

    return selectableOptions.filter((option) => {
      const ratioText = String(option.ratio ?? '').toLowerCase()
      return (
        option.value.toLowerCase().includes(search) ||
        option.label.toLowerCase().includes(search) ||
        option.desc?.toLowerCase().includes(search) ||
        ratioText.includes(search)
      )
    })
  }, [hideDefaultOption, options, searchValue])

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue)
    setOpen(false)
    setSearchValue('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            role='combobox'
            aria-expanded={open}
            data-auto-group-effect={isAutoSelected ? 'trigger' : undefined}
            disabled={disabled}
            className={cn(
              'border-input bg-muted/40 hover:border-ring hover:bg-muted data-popup-open:border-ring data-popup-open:bg-background data-popup-open:ring-ring/20 relative h-9 w-full min-w-0 cursor-pointer justify-between gap-2 px-2.5 text-start shadow-xs transition-[background-color,border-color,box-shadow] duration-150 data-popup-open:ring-[3px] disabled:cursor-not-allowed',
              isAutoSelected &&
                cn(
                  AUTO_GROUP_FRAME_CLASS_NAME,
                  'hover:border-primary/55 data-popup-open:border-primary/55 data-popup-open:ring-primary/20'
                )
            )}
          />
        }
      >
        {isAutoSelected && (
          <AutoGroupFlowBorder shouldReduceMotion={shouldReduceMotion} />
        )}
        <span className='flex min-w-0 flex-1 items-center justify-between gap-2'>
          {selectedOption ? (
            <GroupBadge
              group={selectedOption.value}
              className='h-5 max-w-full px-1.5 text-[11px] leading-none'
            />
          ) : (
            <span className='text-muted-foreground min-w-0 truncate text-sm font-normal'>
              {placeholder || t('Select a group')}
            </span>
          )}
          {selectedOption && (
            <span className='shrink-0 [&_[data-slot=badge]]:text-[10px]'>
              <GroupRatioBadge
                ratio={selectedOption?.ratio}
                isAuto={isAutoSelected}
                shouldReduceMotion={shouldReduceMotion}
              />
            </span>
          )}
        </span>
        <ChevronsUpDown
          aria-hidden='true'
          className='size-4 shrink-0 opacity-50'
        />
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          'data-closed:zoom-out-100 data-open:zoom-in-100 data-[side=bottom]:slide-in-from-top-0 data-[side=left]:slide-in-from-right-0 data-[side=right]:slide-in-from-left-0 data-[side=top]:slide-in-from-bottom-0 data-closed:duration-75 data-open:duration-100',
          groupComboboxContentClassName
        )}
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Command shouldFilter={false} className='rounded-lg! p-0'>
          <CommandInput
            placeholder={t('Search...')}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className={groupComboboxListClassName}>
            <CommandEmpty>{t('No group found.')}</CommandEmpty>
            <CommandGroup className='p-0'>
              {filteredOptions.map((option) => {
                const isAutoOption = option.value === 'auto'

                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    data-checked={value === option.value ? 'true' : undefined}
                    data-auto-group-effect={isAutoOption ? 'option' : undefined}
                    onSelect={() => handleSelect(option.value)}
                    className={cn(
                      groupComboboxItemClassName,
                      isAutoOption &&
                        cn(
                          AUTO_GROUP_FRAME_CLASS_NAME,
                          'border-primary/35 data-selected:border-primary/55 hover:border-primary/55'
                        )
                    )}
                  >
                    {isAutoOption && (
                      <AutoGroupFlowBorder
                        shouldReduceMotion={shouldReduceMotion}
                      />
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
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
