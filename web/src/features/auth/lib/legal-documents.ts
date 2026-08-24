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
import type { SystemStatus } from '../types'

type LegalDocumentContentKey =
  | 'legal_terms_of_service'
  | 'legal_usage_policy'
  | 'legal_supported_regions'
  | 'legal_service_specific_terms'

type LegalDocumentUpdatedAtKey =
  | 'legal_terms_of_service_updated_at'
  | 'legal_usage_policy_updated_at'
  | 'legal_supported_regions_updated_at'
  | 'legal_service_specific_terms_updated_at'

type LegalDocumentConfig = {
  contentKey: LegalDocumentContentKey
  label: string
  updatedAtKey: LegalDocumentUpdatedAtKey
}

export type LegalDocument = {
  content: string
  label: string
  updatedAt?: number
}

const LEGAL_DOCUMENT_CONFIGS: readonly LegalDocumentConfig[] = [
  {
    contentKey: 'legal_terms_of_service',
    label: 'Terms of Service',
    updatedAtKey: 'legal_terms_of_service_updated_at',
  },
  {
    contentKey: 'legal_usage_policy',
    label: 'Usage Policy',
    updatedAtKey: 'legal_usage_policy_updated_at',
  },
  {
    contentKey: 'legal_supported_regions',
    label: 'Supported Countries and Regions',
    updatedAtKey: 'legal_supported_regions_updated_at',
  },
  {
    contentKey: 'legal_service_specific_terms',
    label: 'Service-Specific Terms',
    updatedAtKey: 'legal_service_specific_terms_updated_at',
  },
]

const HTTP_URL_PATTERN = /^https?:\/\//i

export function getLegalDocuments(
  status: SystemStatus | null | undefined
): LegalDocument[] {
  return LEGAL_DOCUMENT_CONFIGS.flatMap((config) => {
    const content =
      status?.[config.contentKey] ?? status?.data?.[config.contentKey] ?? ''
    if (!content.trim()) return []

    const updatedAt =
      status?.[config.updatedAtKey] ?? status?.data?.[config.updatedAtKey]
    return [
      {
        content,
        label: config.label,
        updatedAt: updatedAt && updatedAt > 0 ? updatedAt : undefined,
      },
    ]
  })
}

export function isExternalLegalDocument(content: string): boolean {
  return HTTP_URL_PATTERN.test(content.trim())
}

export function normalizeLegalDocumentContent(content: string): string {
  return content
    .replaceAll('\\r\\n', '\n')
    .replaceAll('\\n', '\n')
    .replaceAll('\\r', '\n')
}
