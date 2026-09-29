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
import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getUserModels } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import {
  filterGroupOptions,
  type CategorizedGroupOption,
} from './group-categories'

export function useGroupModelOptions<T extends CategorizedGroupOption>(
  options: readonly T[],
  enabled = true
): T[] {
  const groupNames = useMemo(
    () => [
      ...new Set(
        filterGroupOptions(options)
          .map((option) => option.value)
          .filter((group) => group !== 'auto')
      ),
    ],
    [options]
  )
  const modelQueries = useQueries({
    queries: groupNames.map((group) => ({
      queryKey: ['user-models', 'group', group],
      queryFn: async () => requireServerSuccess(await getUserModels(group)),
      enabled: enabled && groupNames.length > 0,
      staleTime: Number.POSITIVE_INFINITY,
      meta: { errorToast: false },
    })),
  })

  return useMemo(() => {
    const modelsByGroup = new Map<string, readonly string[]>()
    groupNames.forEach((group, index) => {
      const models = modelQueries[index]?.data?.data
      if (Array.isArray(models)) modelsByGroup.set(group, models)
    })

    return options.map((option) => {
      const models = modelsByGroup.get(option.value)
      return models ? { ...option, models } : option
    })
  }, [groupNames, modelQueries, options])
}
