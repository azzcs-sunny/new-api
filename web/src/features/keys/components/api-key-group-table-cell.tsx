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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { updateApiKeyGroup } from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import type { ApiKey } from '../types'
import { ApiKeyGroupCell } from './api-key-group-cell'
import type { ApiKeyGroupOption } from './api-key-group-combobox'
import { useApiKeys } from './api-keys-provider'

type ApiKeyGroupTableCellProps = {
  apiKey: ApiKey
  options: ApiKeyGroupOption[]
  ratios: Record<string, number | string>
  shouldReduceMotion: boolean
}

export function ApiKeyGroupTableCell(props: ApiKeyGroupTableCellProps) {
  const { t } = useTranslation()
  const { triggerRefresh } = useApiKeys()
  const [pendingGroup, setPendingGroup] = useState<string>()
  const [isUpdating, setIsUpdating] = useState(false)
  const apiKeyGroup = props.apiKey.group || ''
  const group = pendingGroup ?? apiKeyGroup
  let crossGroupRetry = false
  if (group === 'auto') {
    crossGroupRetry =
      apiKeyGroup === 'auto' ? props.apiKey.cross_group_retry : true
  }

  const handleGroupChange = async (nextGroup: string) => {
    setPendingGroup(nextGroup)
    setIsUpdating(true)

    try {
      const result = await updateApiKeyGroup(props.apiKey.id, nextGroup)
      if (!result.success) {
        setPendingGroup(undefined)
        toast.error(result.message || t(ERROR_MESSAGES.UPDATE_FAILED))
        return
      }

      toast.success(t(SUCCESS_MESSAGES.API_KEY_UPDATED))
      triggerRefresh()
    } catch {
      setPendingGroup(undefined)
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <ApiKeyGroupCell
      group={group}
      ratio={props.ratios[group]}
      crossGroupRetry={crossGroupRetry}
      shouldReduceMotion={props.shouldReduceMotion}
      options={props.options}
      onGroupChange={handleGroupChange}
      isUpdating={isUpdating}
    />
  )
}
