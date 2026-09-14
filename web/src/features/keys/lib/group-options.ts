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
const USER_GROUP_LABELS = new Set([
  'usergroup',
  '用户分组',
  '用户组',
  '用戶分組',
  '用戶組',
])

function normalizeGroupLabel(label: string): string {
  return label.trim().replaceAll(/\s+/g, '').toLowerCase()
}

type ApiKeyGroupOptionLike = {
  value: string
  label: string
  desc?: string
}

export function isUserGroupOption(option: ApiKeyGroupOptionLike): boolean {
  const label = normalizeGroupLabel(option.label)
  const desc = option.desc ? normalizeGroupLabel(option.desc) : undefined
  return (
    option.value === '' ||
    USER_GROUP_LABELS.has(label) ||
    (desc ? USER_GROUP_LABELS.has(desc) : false)
  )
}

export function filterApiKeyGroupOptions<T extends ApiKeyGroupOptionLike>(
  options: T[]
): T[] {
  return options.filter((option) => !isUserGroupOption(option))
}
