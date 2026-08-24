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
import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Markdown } from '@/components/ui/markdown'
import { formatDate } from '@/lib/time'
import { cn } from '@/lib/utils'

import {
  getLegalDocuments,
  isExternalLegalDocument,
  normalizeLegalDocumentContent,
  type LegalDocument,
} from '../lib/legal-documents'
import type { SystemStatus } from '../types'

interface TermsFooterProps {
  variant?: 'sign-in' | 'sign-up'
  className?: string
  status?: SystemStatus | null
}

export function TermsFooter({
  variant = 'sign-in',
  className,
  status,
}: TermsFooterProps) {
  const { t } = useTranslation()
  const [selectedDocument, setSelectedDocument] =
    useState<LegalDocument | null>(null)
  const text =
    variant === 'sign-in'
      ? 'By clicking sign in, you agree to our'
      : 'By creating an account, you agree to our'

  const legalDocuments = getLegalDocuments(status)
  const handleDocumentClick = (
    event: MouseEvent<HTMLButtonElement>,
    document: LegalDocument
  ) => {
    event.preventDefault()
    setSelectedDocument(document)
  }

  if (legalDocuments.length === 0) return null

  return (
    <p className={cn('text-muted-foreground text-center text-xs', className)}>
      {t(text)}{' '}
      {legalDocuments.map((document, index) => (
        <span key={document.label}>
          {isExternalLegalDocument(document.content) ? (
            <a
              href={document.content}
              className='hover:text-primary underline underline-offset-4'
            >
              {t(document.label)}
            </a>
          ) : (
            <button
              type='button'
              className='text-primary underline underline-offset-4 hover:opacity-80'
              onClick={(event) => handleDocumentClick(event, document)}
            >
              {t(document.label)}
            </button>
          )}
          {index < legalDocuments.length - 1 ? ` ${t('and')} ` : ''}
        </span>
      ))}
      .
      <Dialog
        open={selectedDocument !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDocument(null)
        }}
        title={selectedDocument ? t(selectedDocument.label) : ''}
        description={
          selectedDocument?.updatedAt
            ? `${t('Last updated:')} ${formatDate(selectedDocument.updatedAt)}`
            : undefined
        }
        contentClassName='max-w-3xl'
      >
        {selectedDocument ? (
          <Markdown>
            {normalizeLegalDocumentContent(selectedDocument.content)}
          </Markdown>
        ) : null}
      </Dialog>
    </p>
  )
}
