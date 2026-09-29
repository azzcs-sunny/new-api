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
import { resolveModelProvider } from '@/lib/model-provider'

export type CategorizedGroupOption = {
  value: string
  label: string
  desc?: string
  ratio?: number | string
  models?: readonly string[]
}

export type GroupCategory = 'anthropic' | 'openai' | 'domestic' | 'other'

const USER_GROUP_LABELS = new Set([
  'usergroup',
  '用户分组',
  '用户组',
  '用戶分組',
  '用戶組',
])

const DOMESTIC_PROVIDERS = new Set([
  '360 AI',
  'BAAI',
  'Baidu',
  'Baichuan',
  'DeepSeek',
  'Doubao',
  'iFlytek',
  'InternLM',
  'Jimeng',
  'Kling',
  'MiMo',
  'MiniMax',
  'Moonshot',
  'Qwen',
  'StepFun',
  'Tencent',
  'Vidu',
  'Wan',
  'Yi',
  'Zhipu',
])
const DOMESTIC_LABEL_KEYWORDS = [
  '国产',
  '国模',
  '国内',
  '通义',
  '千问',
  '智谱',
  '豆包',
  '文心',
  '混元',
  '百川',
  '月之暗面',
  '阶跃',
  '訊飛',
  '讯飞',
  '星火',
  '零一',
]
const OPENAI_LABEL_KEYWORDS = ['openai', 'chatgpt']

function normalizeGroupLabel(label: string): string {
  return label.trim().replaceAll(/\s+/g, '').toLowerCase()
}

export function isUserGroupOption(option: CategorizedGroupOption): boolean {
  const label = normalizeGroupLabel(option.label)
  const desc = option.desc ? normalizeGroupLabel(option.desc) : undefined
  return (
    option.value === '' ||
    USER_GROUP_LABELS.has(label) ||
    (desc ? USER_GROUP_LABELS.has(desc) : false)
  )
}

export function filterGroupOptions<T extends CategorizedGroupOption>(
  options: readonly T[]
): T[] {
  return options.filter((option) => !isUserGroupOption(option))
}

function getTextCategory(searchableText: string): GroupCategory {
  const provider = resolveModelProvider(searchableText)
  if (provider?.name === 'Anthropic') return 'anthropic'
  if (provider?.name === 'OpenAI') return 'openai'
  if (provider && DOMESTIC_PROVIDERS.has(provider.name)) return 'domestic'
  if (provider) return 'other'
  if (
    OPENAI_LABEL_KEYWORDS.some((keyword) => searchableText.includes(keyword))
  ) {
    return 'openai'
  }
  if (
    DOMESTIC_LABEL_KEYWORDS.some((keyword) => searchableText.includes(keyword))
  ) {
    return 'domestic'
  }
  return 'other'
}

export function getGroupCategories(
  option: CategorizedGroupOption
): GroupCategory[] {
  if (option.models?.length) {
    return [
      ...new Set(
        option.models.map((model) =>
          getTextCategory(normalizeGroupLabel(model))
        )
      ),
    ]
  }

  const searchableText = normalizeGroupLabel(
    [option.value, option.label, option.desc].filter(Boolean).join(' ')
  )
  return [getTextCategory(searchableText)]
}

export function getGroupCategory(
  option: CategorizedGroupOption
): GroupCategory {
  return getGroupCategories(option)[0] ?? 'other'
}
