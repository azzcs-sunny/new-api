/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type LegalDocumentValues = {
  termsOfService: string
  usagePolicy: string
  supportedRegions: string
  serviceSpecificTerms: string
}

type LegalDocumentsSectionProps = {
  defaultValues: LegalDocumentValues
}

const DOCUMENTS = [
  {
    id: 'termsOfService',
    key: 'legal.terms_of_service',
    label: 'Terms of Service',
  },
  { id: 'usagePolicy', key: 'legal.usage_policy', label: 'Usage Policy' },
  {
    id: 'supportedRegions',
    key: 'legal.supported_regions',
    label: 'Supported Countries and Regions',
  },
  {
    id: 'serviceSpecificTerms',
    key: 'legal.service_specific_terms',
    label: 'Service-Specific Terms',
  },
] as const

export function LegalDocumentsSection({
  defaultValues,
}: LegalDocumentsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [values, setValues] = useState<LegalDocumentValues>(defaultValues)

  useEffect(() => {
    // Keep the draft aligned when settings are refreshed from the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(defaultValues)
  }, [defaultValues])

  return (
    <SettingsSection title={t('Legal Documents')}>
      <div className='text-muted-foreground text-sm'>
        {t(
          'Manage the links or content displayed for the four required legal documents.'
        )}
      </div>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Document')}</TableHead>
              <TableHead>{t('Content or URL')}</TableHead>
              <TableHead className='w-28 text-right'>{t('Action')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DOCUMENTS.map((document) => (
              <TableRow key={document.key}>
                <TableCell className='align-top font-medium'>
                  {t(document.label)}
                </TableCell>
                <TableCell className='min-w-72 align-top'>
                  <Textarea
                    rows={3}
                    value={values[document.id]}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [document.id]: event.target.value,
                      }))
                    }
                    placeholder={t('Enter Markdown, HTML, or a full URL')}
                  />
                </TableCell>
                <TableCell className='text-right align-top'>
                  <Button
                    type='button'
                    size='sm'
                    className='gap-1'
                    disabled={updateOption.isPending}
                    onClick={() =>
                      updateOption.mutate({
                        key: document.key,
                        value: values[document.id],
                      })
                    }
                  >
                    <Save className='h-3.5 w-3.5' />
                    {t('Save')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SettingsSection>
  )
}
