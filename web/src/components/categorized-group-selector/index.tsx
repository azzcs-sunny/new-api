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
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

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
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import {
  filterGroupOptions,
  getGroupCategories,
  getGroupCategory,
  isUserGroupOption,
  type CategorizedGroupOption,
  type GroupCategory,
} from './group-categories'

export type { CategorizedGroupOption, GroupCategory }

type DataAttributes = {
  [key: `data-${string}`]: string | undefined
}

type CategorizedGroupSelectorProps = {
  options: readonly CategorizedGroupOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  loading?: boolean
  allowCustomValue?: boolean
  clearable?: boolean
  excludeValues?: readonly string[]
  className?: string
  popupClassName?: string
  listClassName?: string
  itemClassName?: string
  'aria-label'?: string
  renderValue?: (
    option: CategorizedGroupOption | undefined,
    value: string | undefined
  ) => ReactNode
  renderOption?: (option: CategorizedGroupOption) => ReactNode
  renderTriggerLeading?: (
    option: CategorizedGroupOption | undefined
  ) => ReactNode
  getTriggerAttributes?: (
    option: CategorizedGroupOption | undefined
  ) => DataAttributes
  getOptionAttributes?: (option: CategorizedGroupOption) => DataAttributes
  getOptionClassName?: (option: CategorizedGroupOption) => string | undefined
}

const categories: Array<{
  value: GroupCategory
  label: 'Anthropic' | 'OpenAI' | 'Chinese Models' | 'Other'
  icons: Array<{ key: string; node: ReactNode }>
}> = [
  {
    value: 'anthropic',
    label: 'Anthropic',
    icons: [{ key: 'claude', node: getLobeIcon('Claude.Color', 22) }],
  },
  {
    value: 'openai',
    label: 'OpenAI',
    icons: [{ key: 'openai', node: getLobeIcon('OpenAI', 22) }],
  },
  {
    value: 'domestic',
    label: 'Chinese Models',
    icons: [
      { key: 'deepseek', node: getLobeIcon('DeepSeek.Color', 22) },
      { key: 'kimi', node: getLobeIcon('Kimi.Color', 22) },
    ],
  },
  {
    value: 'other',
    label: 'Other',
    icons: [
      { key: 'gemini', node: getLobeIcon('Gemini.Color', 22) },
      { key: 'grok', node: getLobeIcon('Grok', 22) },
    ],
  },
]

export function CategorizedGroupSelector(props: CategorizedGroupSelectorProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [activeCategory, setActiveCategory] = useState<GroupCategory>('openai')
  const selectedOption = props.options.find(
    (option) => option.value === props.value
  )
  const renderedValue = props.renderValue?.(selectedOption, props.value)
  const excludedValues = useMemo(
    () => new Set(props.excludeValues ?? []),
    [props.excludeValues]
  )
  const selectableOptions = useMemo(
    () =>
      filterGroupOptions(props.options).filter(
        (option) => !excludedValues.has(option.value)
      ),
    [excludedValues, props.options]
  )
  const blockedCustomValues = useMemo(
    () =>
      new Set(
        props.options
          .filter((option) => isUserGroupOption(option))
          .map((option) => option.value)
      ),
    [props.options]
  )
  const visibleOptions = useMemo(() => {
    const search = searchValue.trim().toLowerCase()
    return selectableOptions.filter((option) => {
      if (!search && !getGroupCategories(option).includes(activeCategory)) {
        return false
      }
      if (!search) return true

      return [option.value, option.label, option.desc, option.ratio]
        .filter((part) => part !== undefined)
        .some((part) => String(part).toLowerCase().includes(search))
    })
  }, [activeCategory, searchValue, selectableOptions])
  const customValue = searchValue.trim()
  const showCustomValue =
    props.allowCustomValue &&
    customValue !== '' &&
    !excludedValues.has(customValue) &&
    !blockedCustomValues.has(customValue) &&
    !isUserGroupOption({ value: customValue, label: customValue }) &&
    !selectableOptions.some((option) => option.value === customValue)

  const handleSelect = (value: string) => {
    props.onValueChange(value)
    const option = selectableOptions.find(
      (candidate) => candidate.value === value
    )
    if (option && !getGroupCategories(option).includes(activeCategory)) {
      setActiveCategory(getGroupCategory(option))
    }
    setOpen(false)
    setSearchValue('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setSearchValue('')
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            role='combobox'
            aria-label={props['aria-label']}
            aria-busy={props.loading}
            aria-expanded={open}
            disabled={props.disabled}
            className={cn(
              'h-9 w-full min-w-0 cursor-pointer justify-between gap-2 px-2.5',
              props.className
            )}
            {...props.getTriggerAttributes?.(selectedOption)}
          />
        }
      >
        {props.renderTriggerLeading?.(selectedOption)}
        <span className='flex min-w-0 flex-1 items-center gap-2 text-start'>
          {renderedValue ??
            (props.value ? (
              <span className='truncate'>
                {selectedOption?.label ?? props.value}
              </span>
            ) : (
              <span className='text-muted-foreground truncate font-normal'>
                {props.placeholder ?? t('Select a group')}
              </span>
            ))}
        </span>
        {props.loading ? (
          <Loader2 aria-hidden='true' className='shrink-0 animate-spin' />
        ) : (
          <ChevronsUpDown aria-hidden='true' className='shrink-0 opacity-50' />
        )}
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className={cn(
          'max-h-[min(26rem,var(--available-height))] w-[480px] max-w-[calc(100vw-2rem)] overflow-hidden overscroll-contain rounded-lg p-0 shadow-lg',
          props.popupClassName
        )}
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Command shouldFilter={false} className='rounded-lg! p-0'>
          <div className='flex flex-col gap-2 p-2 pb-1.5'>
            <span className='text-muted-foreground px-0.5 text-xs font-medium'>
              {t('Vendor')}
            </span>
            <div
              role='tablist'
              aria-label={t('Vendor')}
              className='grid grid-cols-4 gap-1.5'
            >
              {categories.map((category) => (
                <Button
                  key={category.value}
                  type='button'
                  variant='outline'
                  role='tab'
                  aria-selected={activeCategory === category.value}
                  data-active={
                    activeCategory === category.value ? 'true' : undefined
                  }
                  onClick={() => {
                    setActiveCategory(category.value)
                    setSearchValue('')
                  }}
                  className='data-[active=true]:border-primary data-[active=true]:bg-accent relative h-16 min-w-0 flex-col gap-1 px-1 py-1.5 text-xs whitespace-normal'
                >
                  <span
                    aria-hidden='true'
                    className='flex h-6 items-center justify-center gap-1'
                  >
                    {category.icons.map((icon) => (
                      <span
                        key={icon.key}
                        className='flex size-6 items-center justify-center'
                      >
                        {icon.node}
                      </span>
                    ))}
                  </span>
                  <span className='max-w-full truncate'>
                    {t(category.label)}
                  </span>
                  {activeCategory === category.value && (
                    <span className='bg-primary text-primary-foreground absolute top-1 right-1 flex size-4 items-center justify-center rounded-full'>
                      <Check aria-hidden='true' className='size-3' />
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
          <CommandInput
            placeholder={props.searchPlaceholder ?? t('Search...')}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList
            className={cn(
              'max-h-[min(17rem,var(--available-height))] overflow-y-auto overscroll-contain p-1.5',
              props.listClassName
            )}
          >
            <CommandEmpty>
              {props.emptyText ?? t('No group found.')}
            </CommandEmpty>
            <CommandGroup className='p-0'>
              {props.clearable && props.value && !searchValue && (
                <CommandItem
                  value='__clear_group__'
                  onSelect={() => handleSelect('')}
                  className='cursor-pointer'
                >
                  <span className='text-muted-foreground'>{t('Clear')}</span>
                </CommandItem>
              )}
              {visibleOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  data-checked={
                    props.value === option.value ? 'true' : undefined
                  }
                  onSelect={() => handleSelect(option.value)}
                  className={cn(
                    'cursor-pointer items-center gap-1.5 rounded-md py-2.5 pr-1.5 pl-1.5 text-xs whitespace-normal transition-colors hover:bg-accent hover:text-accent-foreground data-selected:bg-accent data-selected:text-accent-foreground',
                    props.itemClassName,
                    props.getOptionClassName?.(option)
                  )}
                  {...props.getOptionAttributes?.(option)}
                >
                  {props.renderOption ? (
                    props.renderOption(option)
                  ) : (
                    <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
                      <span className='truncate text-sm'>{option.label}</span>
                      {option.desc && option.desc !== option.label && (
                        <span className='text-muted-foreground truncate text-xs'>
                          {option.desc}
                        </span>
                      )}
                    </span>
                  )}
                </CommandItem>
              ))}
              {showCustomValue && (
                <CommandItem
                  value={`__custom_group__${customValue}`}
                  onSelect={() => handleSelect(customValue)}
                  className='cursor-pointer'
                >
                  <span className='min-w-0 truncate text-sm'>
                    {customValue}
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
