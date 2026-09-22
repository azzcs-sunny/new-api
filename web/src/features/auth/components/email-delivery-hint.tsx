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
import { Alert02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'

export function EmailDeliveryHint() {
  const { t } = useTranslation()

  return (
    <Badge
      variant='warning'
      role='note'
      className='h-auto max-w-full justify-start py-1.5 whitespace-normal'
    >
      <HugeiconsIcon
        icon={Alert02Icon}
        strokeWidth={2}
        data-icon='inline-start'
        aria-hidden='true'
      />
      {t("If you don't receive the email, check your spam folder.")}
    </Badge>
  )
}
