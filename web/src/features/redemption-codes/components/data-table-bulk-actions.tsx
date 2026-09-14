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
import type { Table } from '@tanstack/react-table'
import { ReceiptText } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CopyButton } from '@/components/copy-button'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import { batchUpdateRedemptionInvoiceSettings } from '../api'
import type { Redemption } from '../types'
import { useRedemptions } from './redemptions-provider'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const { t } = useTranslation()
  const { triggerRefresh } = useRedemptions()
  const selectedRows = table.getSelectedRowModel().rows
  const selectedIds = useMemo(
    () => selectedRows.map((row) => (row.original as Redemption).id),
    [selectedRows]
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [invoiceEnabled, setInvoiceEnabled] = useState(true)
  const [invoiceAmount, setInvoiceAmount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const contentToCopy = useMemo(() => {
    const selectedCodes = selectedRows.map((row) => {
      const redemption = row.original as Redemption
      return `${redemption.name}\t${redemption.key}`
    })
    return selectedCodes.join('\n')
  }, [selectedRows])

  const handleBatchUpdate = async () => {
    if (selectedIds.length === 0) return
    if (invoiceEnabled && invoiceAmount <= 0) {
      toast.error(t('Invoice amount must be greater than 0'))
      return
    }
    setIsSubmitting(true)
    try {
      const result = await batchUpdateRedemptionInvoiceSettings({
        ids: selectedIds,
        invoice_enabled: invoiceEnabled,
        invoice_amount: invoiceEnabled ? invoiceAmount : 0,
      })
      if (!result.success) {
        toast.error(result.message || t('Failed to update invoice settings'))
        return
      }
      const data = result.data
      toast.success(
        t(
          'Updated {{updated}} code(s), created {{created}} order(s), skipped {{skipped}} invoiced code(s)',
          {
            updated: data?.updated ?? 0,
            created: data?.created_orders ?? 0,
            skipped: data?.skipped_invoiced ?? 0,
          }
        )
      )
      table.resetRowSelection()
      setDialogOpen(false)
      triggerRefresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName={t('redemption code')}>
        <Button
          variant='outline'
          size='icon'
          className='size-8'
          onClick={() => setDialogOpen(true)}
          aria-label={t('Batch invoice settings')}
          title={t('Batch invoice settings')}
        >
          <ReceiptText className='h-4 w-4' />
        </Button>
        <CopyButton
          value={contentToCopy}
          variant='outline'
          size='icon'
          className='size-8'
          tooltip={t('Copy selected codes')}
          successTooltip={t('Codes copied!')}
          aria-label={t('Copy selected codes')}
        />
      </BulkActionsToolbar>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('Batch invoice settings')}</DialogTitle>
            <DialogDescription>
              {t(
                'Update invoice eligibility for selected redemption codes. Used codes will get a redemption order when possible.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='flex items-center justify-between gap-3 rounded-lg border p-3'>
              <div className='space-y-1'>
                <Label>{t('Allow invoice')}</Label>
                <p className='text-muted-foreground text-xs'>
                  {t('Selected codes can be used for invoice requests.')}
                </p>
              </div>
              <Switch
                checked={invoiceEnabled}
                onCheckedChange={setInvoiceEnabled}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='batch-invoice-amount'>
                {t('Invoice amount')}
              </Label>
              <Input
                id='batch-invoice-amount'
                type='number'
                min='0'
                step='0.01'
                disabled={!invoiceEnabled}
                value={invoiceAmount}
                onChange={(event) =>
                  setInvoiceAmount(
                    Number.parseFloat(event.target.value) || 0
                  )
                }
                placeholder={t('Enter invoice amount')}
              />
              <p className='text-muted-foreground text-xs'>
                {t(
                  'Orders already in an invoice request will be skipped automatically.'
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setDialogOpen(false)}
              disabled={isSubmitting}
            >
              {t('Cancel')}
            </Button>
            <Button onClick={handleBatchUpdate} disabled={isSubmitting}>
              {isSubmitting ? t('Saving...') : t('Save changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
