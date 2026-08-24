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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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

interface LegalConsentProps {
  status: SystemStatus | null
  checked: boolean
  onCheckedChange: (nextValue: boolean) => void
  className?: string
}

export function LegalConsent({
  status,
  checked,
  onCheckedChange,
  className,
}: LegalConsentProps) {
  const { t } = useTranslation()
  const [selectedDocument, setSelectedDocument] =
    useState<LegalDocument | null>(null)
  const handleChange = (value: boolean) => {
    onCheckedChange(value === true)
  }

  const legalDocuments = getLegalDocuments(status)

  const handleDocumentClick = (
    event: MouseEvent<HTMLButtonElement>,
    document: LegalDocument
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedDocument(document)
  }

  if (legalDocuments.length === 0) return null

  return (
    <div
      className={cn(
        'border-border/60 bg-muted/40 flex items-start gap-3 rounded-md border p-3',
        className
      )}
    >
      <Checkbox
        id='legal-consent'
        checked={checked}
        onCheckedChange={handleChange}
        className='mt-0.5'
      />
      <Label
        htmlFor='legal-consent'
        className='text-muted-foreground items-start gap-1 text-left text-xs leading-5 font-normal'
      >
        <span className='flex flex-wrap items-center gap-x-1'>
          {t('I have read and agree to the')}{' '}
          {legalDocuments.map((document, index) => (
            <span
              key={document.label}
              className='inline-flex items-center gap-x-1'
            >
              {isExternalLegalDocument(document.content) ? (
                <a
                  href={document.content}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary hover:underline'
                >
                  {t(document.label)}
                </a>
              ) : (
                <button
                  type='button'
                  className='text-primary hover:underline'
                  onClick={(event) => handleDocumentClick(event, document)}
                >
                  {t(document.label)}
                </button>
              )}
              {index < legalDocuments.length - 1 ? t('and') : null}
            </span>
          ))}
          .
        </span>
      </Label>
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
    </div>
  )
}
