/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import {
  AddInvoiceIcon,
  Alert02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Building03Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Download01Icon,
  FileCheckIcon,
  FileIcon,
  InformationCircleIcon,
  Loading03Icon,
  Refresh01Icon,
  UserIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import {
  createInvoice,
  getAdminInvoices,
  getEligibleOrders,
  getInvoiceSettings,
  getInvoices,
  issueInvoice,
  processInvoice,
  rejectInvoice,
  updateInvoiceSettings,
} from './api'
import { exportProcessingInvoices } from './lib/export-invoices'
import type { Invoice, InvoiceOrder } from './types'

function Icon({
  icon,
  className,
}: {
  icon: IconSvgElement
  className?: string
}) {
  return <HugeiconsIcon icon={icon} strokeWidth={2} className={className} />
}

function statusLabel(status: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    pending: t('Pending'),
    processing: t('Processing'),
    issued: t('Issued'),
    rejected: t('Rejected'),
    cancelled: t('Cancelled'),
  }
  return labels[status] || status
}

function invoiceIntervalLabel(interval: number, t: (key: string) => string) {
  if (interval === 0) return t('No frequency limit')
  if (interval === 15) return t('Every 15 days')
  return t('Every 30 days')
}

function invoiceNotes(invoice: Invoice, t: (key: string) => string) {
  if (invoice.reject_reason) {
    return <span className='text-destructive'>{invoice.reject_reason}</span>
  }
  if (invoice.status === 'issued') {
    return (
      <span className='text-muted-foreground'>
        {t('Invoice sent to your email')}
      </span>
    )
  }
  return '-'
}

function statusVariant(
  status: string
): 'default' | 'secondary' | 'warning' | 'destructive' | 'outline' {
  if (status === 'issued') return 'default'
  if (status === 'rejected' || status === 'cancelled') return 'destructive'
  if (status === 'processing') return 'warning'
  return 'secondary'
}

export function OrderRow({
  order,
  checked,
  disabled,
  onChange,
}: {
  order: InvoiceOrder
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div
      className={`flex items-center gap-3 border-b px-4 py-3 transition-colors last:border-b-0 ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted/40'} ${checked ? 'bg-primary/5' : ''}`}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        aria-label={order.trade_no}
        onCheckedChange={(value) => onChange(!!value)}
      />
      <span className='min-w-0 flex-1'>
        <span className='block truncate font-mono text-sm'>
          {order.trade_no}
        </span>
        <span className='text-muted-foreground mt-0.5 block text-xs'>
          {new Date(order.create_time * 1000).toLocaleString()}
        </span>
      </span>
      <span className='text-sm font-semibold tabular-nums'>
        {order.money.toFixed(2)}
      </span>
    </div>
  )
}

function InvoiceForm() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [eligiblePage, setEligiblePage] = useState(1)
  const ordersQuery = useQuery({
    queryKey: ['invoices', 'eligible', eligiblePage],
    queryFn: () => getEligibleOrders(eligiblePage),
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  })
  const [page, setPage] = useState(1)
  const invoicesQuery = useQuery({
    queryKey: ['invoices', 'mine', page],
    queryFn: () => getInvoices(page),
  })
  const [selected, setSelected] = useState<number[]>([])
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [buyerType, setBuyerType] = useState('company')
  const [showMoreSettings, setShowMoreSettings] = useState(false)
  const [form, setForm] = useState({
    title: '',
    email: '',
    tax_number: '',
    address: '',
    phone: '',
    bank_name: '',
    bank_account: '',
  })
  const mutation = useMutation({
    mutationFn: () =>
      createInvoice({
        order_ids: selected,
        invoice_type: 'normal',
        buyer_type: buyerType,
        title: form.title,
        email: form.email,
        ...(buyerType === 'company'
          ? {
              tax_number: form.tax_number,
              address: form.address,
              phone: form.phone,
              bank_name: form.bank_name,
              bank_account: form.bank_account,
            }
          : {}),
      }),
    onSuccess: () => {
      toast.success(t('Invoice request submitted'))
      setSelected([])
      setEligiblePage(1)
      setInvoiceDialogOpen(false)
      setBuyerType('company')
      setShowMoreSettings(false)
      setForm({
        title: '',
        email: '',
        tax_number: '',
        address: '',
        phone: '',
        bank_name: '',
        bank_account: '',
      })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (error) =>
      toast.error(
        t(error instanceof Error ? error.message : 'Something went wrong!')
      ),
  })
  const orders = useMemo(
    () => ordersQuery.data?.items ?? [],
    [ordersQuery.data?.items]
  )
  const canSubmit = ordersQuery.data?.can_submit !== false
  const emailIsValid =
    form.email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
  const setField = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))
  let ordersContent: React.ReactNode
  if (ordersQuery.isLoading) {
    ordersContent = (
      <div className='text-muted-foreground flex items-center justify-center gap-2 p-10 text-sm'>
        <Icon icon={Loading03Icon} className='size-4 animate-spin' />
        {t('Loading...')}
      </div>
    )
  } else if (orders.length === 0) {
    ordersContent = (
      <Empty className='min-h-56 rounded-none border-0'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <Icon icon={FileIcon} />
          </EmptyMedia>
          <EmptyTitle>{t('No eligible orders found')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'Only successful top-up orders that have not been invoiced can be selected.'
            )}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else {
    ordersContent = orders.map((order) => (
      <OrderRow
        key={order.topup_id}
        order={order}
        checked={selected.includes(order.topup_id)}
        disabled={!canSubmit || mutation.isPending}
        onChange={(checked) =>
          setSelected((current) => {
            if (!checked) {
              return current.filter((id) => id !== order.topup_id)
            }
            if (current.includes(order.topup_id)) return current
            return [...current, order.topup_id]
          })
        }
      />
    ))
  }

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Invoices')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-6'>
          {ordersQuery.data?.description && (
            <Alert className='border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'>
              <Icon
                icon={Alert02Icon}
                className='text-amber-600 dark:text-amber-400'
              />
              <AlertTitle>{t('Friendly reminder')}</AlertTitle>
              <AlertDescription className='whitespace-pre-wrap text-amber-900/80 dark:text-amber-100/80'>
                {ordersQuery.data.description}
              </AlertDescription>
            </Alert>
          )}

          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            {canSubmit && !ordersQuery.isLoading && orders.length === 0 && (
              <Alert className='sm:max-w-xl'>
                <AlertDescription>
                  {t(
                    'Only successful top-up orders that have not been invoiced can be selected.'
                  )}
                </AlertDescription>
              </Alert>
            )}
            <Dialog
              title={t('Request an invoice')}
              description={t(
                'Select completed orders and provide your invoice information.'
              )}
              open={invoiceDialogOpen}
              onOpenChange={setInvoiceDialogOpen}
              contentClassName='sm:max-w-3xl'
            >
              <div className='grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]'>
                <Card className='overflow-hidden'>
                  <CardHeader className='bg-muted/20 border-b'>
                    <CardTitle className='flex items-center justify-between gap-3 text-base'>
                      <span>{t('Eligible top-up orders')}</span>
                      <span className='text-muted-foreground text-xs font-normal'>
                        {t('{{count}} order(s) selected', {
                          count: selected.length,
                        })}
                      </span>
                    </CardTitle>
                    <div className='text-muted-foreground border-t pt-3 text-xs'>
                      <span className='font-medium'>{t('Order IDs')}:</span>{' '}
                      <span className='font-mono'>
                        {selected.length > 0 ? selected.join(', ') : '-'}
                      </span>
                    </div>
                    <p className='text-muted-foreground text-sm'>
                      {t(
                        'Only successful top-up orders that have not been invoiced can be selected.'
                      )}
                    </p>
                  </CardHeader>
                  <CardContent className='p-0'>{ordersContent}</CardContent>
                  {(ordersQuery.data?.total || 0) > 20 && (
                    <div className='border-t px-4 py-3'>
                      <Pagination
                        page={eligiblePage}
                        total={ordersQuery.data?.total || 0}
                        pageSize={20}
                        loading={ordersQuery.isFetching}
                        onPageChange={setEligiblePage}
                      />
                    </div>
                  )}
                </Card>

                <Card>
                  <CardHeader className='bg-muted/20 border-b'>
                    <CardTitle className='flex items-center gap-2 text-base'>
                      <Icon
                        icon={
                          buyerType === 'company' ? Building03Icon : UserIcon
                        }
                        className='size-4'
                      />
                      {t('Invoice information')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='pt-5'>
                    <FieldGroup>
                      {!canSubmit && (
                        <div className='bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg p-3 text-sm'>
                          <Icon
                            icon={InformationCircleIcon}
                            className='mt-0.5 size-4 shrink-0'
                          />
                          {t(
                            'Please wait until the current request window ends before submitting another invoice.'
                          )}
                        </div>
                      )}
                      <Field>
                        <FieldLabel>{t('Invoice type')}</FieldLabel>
                        <Select value='normal' disabled>
                          <SelectTrigger>
                            <SelectValue>
                              {t('Electronic normal invoice')}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value='normal'>
                                {t('Electronic normal invoice')}
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>{t('Title type')}</FieldLabel>
                        <Select value='company' disabled>
                          <SelectTrigger>
                            <SelectValue>{t('Unit')}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value='individual'>
                                {t('Individual')}
                              </SelectItem>
                              <SelectItem value='company'>
                                {t('Unit')}
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor='invoice-title'>
                          {t('Title name')}
                        </FieldLabel>
                        <Input
                          id='invoice-title'
                          value={form.title}
                          maxLength={200}
                          onChange={(e) => setField('title', e.target.value)}
                          placeholder={t('Enter the invoice title')}
                        />
                      </Field>
                      {buyerType === 'company' && (
                        <Field>
                          <FieldLabel htmlFor='invoice-tax'>
                            {t('Unit tax number')}
                          </FieldLabel>
                          <Input
                            id='invoice-tax'
                            value={form.tax_number}
                            maxLength={100}
                            onChange={(e) =>
                              setField('tax_number', e.target.value)
                            }
                            placeholder={t('Enter the unit tax number')}
                          />
                          <FieldDescription>
                            {t('Required for company invoices')}
                          </FieldDescription>
                        </Field>
                      )}
                      <Field>
                        <FieldLabel htmlFor='invoice-email'>
                          {t('Email')}
                        </FieldLabel>
                        <Input
                          id='invoice-email'
                          type='email'
                          value={form.email}
                          maxLength={254}
                          aria-invalid={!emailIsValid}
                          onChange={(e) => setField('email', e.target.value)}
                          placeholder={t('Enter your email')}
                        />
                        {!emailIsValid && (
                          <FieldDescription className='text-destructive'>
                            {t('Invalid email address')}
                          </FieldDescription>
                        )}
                        <FieldDescription className='text-destructive font-medium'>
                          {t('The invoice will be sent to this email address.')}
                        </FieldDescription>
                      </Field>
                      {buyerType === 'company' && (
                        <>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            className='w-fit px-0'
                            aria-expanded={showMoreSettings}
                            onClick={() =>
                              setShowMoreSettings((value) => !value)
                            }
                          >
                            <Icon
                              icon={
                                showMoreSettings
                                  ? ArrowUp01Icon
                                  : ArrowDown01Icon
                              }
                              className='size-4'
                            />
                            {t(
                              showMoreSettings
                                ? 'Hide more settings'
                                : 'Show more settings'
                            )}
                          </Button>
                          {showMoreSettings && (
                            <div className='grid gap-4 sm:grid-cols-2'>
                              <Field className='sm:col-span-2'>
                                <FieldLabel htmlFor='invoice-address'>
                                  {t('Registered address')}
                                </FieldLabel>
                                <Textarea
                                  id='invoice-address'
                                  value={form.address}
                                  maxLength={500}
                                  onChange={(e) =>
                                    setField('address', e.target.value)
                                  }
                                  placeholder={t(
                                    'Enter the registered address'
                                  )}
                                />
                              </Field>
                              <Field>
                                <FieldLabel htmlFor='invoice-phone'>
                                  {t('Registered phone')}
                                </FieldLabel>
                                <Input
                                  id='invoice-phone'
                                  value={form.phone}
                                  maxLength={50}
                                  onChange={(e) =>
                                    setField('phone', e.target.value)
                                  }
                                  placeholder={t(
                                    'Enter your registered phone number'
                                  )}
                                />
                              </Field>
                              <Field>
                                <FieldLabel htmlFor='invoice-bank'>
                                  {t('Bank name')}
                                </FieldLabel>
                                <Input
                                  id='invoice-bank'
                                  value={form.bank_name}
                                  maxLength={200}
                                  onChange={(e) =>
                                    setField('bank_name', e.target.value)
                                  }
                                  placeholder={t('Enter the bank name')}
                                />
                              </Field>
                              <Field>
                                <FieldLabel htmlFor='invoice-account'>
                                  {t('Bank account')}
                                </FieldLabel>
                                <Input
                                  id='invoice-account'
                                  value={form.bank_account}
                                  maxLength={100}
                                  onChange={(e) =>
                                    setField('bank_account', e.target.value)
                                  }
                                  placeholder={t('Enter the bank account')}
                                />
                              </Field>
                            </div>
                          )}
                        </>
                      )}
                      <Button
                        className='w-full'
                        disabled={
                          !canSubmit ||
                          selected.length === 0 ||
                          !form.title.trim() ||
                          !emailIsValid ||
                          mutation.isPending
                        }
                        onClick={() => mutation.mutate()}
                      >
                        {mutation.isPending ? (
                          <Icon
                            icon={Loading03Icon}
                            className='size-4 animate-spin'
                          />
                        ) : (
                          <Icon icon={AddInvoiceIcon} className='size-4' />
                        )}
                        {t('Submit invoice request')}
                      </Button>
                    </FieldGroup>
                  </CardContent>
                </Card>
              </div>
            </Dialog>
          </div>

          <section className='space-y-3'>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <h2 className='text-base font-semibold'>
                  {t('Invoice history')}
                </h2>
                <p className='text-muted-foreground text-sm'>
                  {t('Track the status of your previous invoice requests.')}
                </p>
              </div>
              {!canSubmit ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger render={<span className='inline-flex' />}>
                      <Button disabled>
                        <Icon icon={AddInvoiceIcon} className='size-4' />
                        {t('Add invoice')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='top' className='max-w-xs text-center'>
                      {t(
                        'Please wait until the current request window ends before submitting another invoice.'
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button
                  disabled={orders.length === 0}
                  onClick={() => setInvoiceDialogOpen(true)}
                >
                  <Icon icon={AddInvoiceIcon} className='size-4' />
                  {t('Add invoice')}
                </Button>
              )}
            </div>
            <Card className='overflow-hidden'>
              <CardContent className='max-h-[min(45vh,28rem)] overflow-auto p-0'>
                {(invoicesQuery.data?.items || []).length === 0 ? (
                  <Empty className='min-h-48 rounded-none border-0'>
                    <EmptyHeader>
                      <EmptyMedia variant='icon'>
                        <Icon icon={FileIcon} />
                      </EmptyMedia>
                      <EmptyTitle>{t('No invoice requests yet.')}</EmptyTitle>
                      <EmptyDescription>
                        {t('Your submitted requests will appear here.')}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Table className='min-w-[760px]'>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Invoice ID')}</TableHead>
                        <TableHead>{t('Status')}</TableHead>
                        <TableHead>{t('Invoice title')}</TableHead>
                        <TableHead>{t('Top-up orders')}</TableHead>
                        <TableHead>{t('Amount')}</TableHead>
                        <TableHead>{t('Submitted at')}</TableHead>
                        <TableHead>{t('Notes')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(invoicesQuery.data?.items || []).map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className='font-medium'>
                            #{invoice.id}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(invoice.status)}>
                              {statusLabel(invoice.status, t)}
                            </Badge>
                          </TableCell>
                          <TableCell className='max-w-48 truncate'>
                            {invoice.title}
                          </TableCell>
                          <TableCell className='max-w-64 whitespace-normal'>
                            {invoice.orders
                              ?.map((order) => order.topup.trade_no)
                              .join(', ') || '-'}
                          </TableCell>
                          <TableCell className='whitespace-nowrap'>
                            {invoice.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className='whitespace-nowrap'>
                            {new Date(
                              invoice.create_time * 1000
                            ).toLocaleDateString()}
                          </TableCell>
                          <TableCell className='max-w-56 text-xs whitespace-normal'>
                            {invoiceNotes(invoice, t)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            {(invoicesQuery.data?.total || 0) > 20 && (
              <Pagination
                page={page}
                total={invoicesQuery.data?.total || 0}
                pageSize={20}
                loading={invoicesQuery.isFetching}
                onPageChange={setPage}
              />
            )}
          </section>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function Pagination({
  page,
  total,
  pageSize,
  loading,
  onPageChange,
}: {
  page: number
  total: number
  pageSize: number
  loading: boolean
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation()
  const pages = Math.ceil(total / pageSize)
  return (
    <div className='text-muted-foreground flex items-center justify-end gap-3 text-sm'>
      <span>{t('Page {{page}} of {{pages}}', { page, pages })}</span>
      <Button
        size='icon'
        variant='outline'
        aria-label={t('Previous')}
        disabled={page === 1 || loading}
        onClick={() => onPageChange(page - 1)}
      >
        <Icon icon={ArrowLeft01Icon} className='size-4' />
      </Button>
      <Button
        size='icon'
        variant='outline'
        aria-label={t('Next')}
        disabled={page >= pages || loading}
        onClick={() => onPageChange(page + 1)}
      >
        <Icon icon={ArrowRight01Icon} className='size-4' />
      </Button>
    </div>
  )
}

type AdminInvoiceTableProps = {
  invoices: Invoice[]
  selectedIds: number[]
  busy: boolean
  exporting: boolean
  onSelectionChange: (ids: number[]) => void
  onExport: (invoices: Invoice[]) => void
  onProcess: (invoice: Invoice) => void
  onIssue: (invoice: Invoice) => void
  onReject: (invoice: Invoice) => void
}

export function AdminInvoiceTable(props: AdminInvoiceTableProps) {
  const { t } = useTranslation()
  const selectedIdSet = new Set(props.selectedIds)
  const processingInvoices = props.invoices.filter(
    (invoice) => invoice.status === 'processing'
  )
  const allProcessingSelected =
    processingInvoices.length > 0 &&
    processingInvoices.every((invoice) => selectedIdSet.has(invoice.id))
  const someProcessingSelected = processingInvoices.some((invoice) =>
    selectedIdSet.has(invoice.id)
  )

  return (
    <div className='overflow-hidden rounded-md border'>
      <TooltipProvider>
        <Table className='min-w-[1280px]'>
          <TableHeader>
            <TableRow className='bg-muted/40 hover:bg-muted/40'>
              <TableHead className='w-10 pl-4'>
                <Checkbox
                  checked={allProcessingSelected}
                  indeterminate={
                    someProcessingSelected && !allProcessingSelected
                  }
                  disabled={processingInvoices.length === 0}
                  aria-label={t('Select all')}
                  onCheckedChange={(checked) =>
                    props.onSelectionChange(
                      checked
                        ? processingInvoices.map((invoice) => invoice.id)
                        : []
                    )
                  }
                />
              </TableHead>
              <TableHead className='w-20'>{t('Invoice ID')}</TableHead>
              <TableHead className='w-24'>{t('Status')}</TableHead>
              <TableHead className='w-20'>{t('User ID')}</TableHead>
              <TableHead className='w-24'>{t('Title type')}</TableHead>
              <TableHead className='min-w-48'>{t('Invoice title')}</TableHead>
              <TableHead className='min-w-44'>{t('Tax number')}</TableHead>
              <TableHead className='min-w-52'>{t('Email')}</TableHead>
              <TableHead className='min-w-56'>{t('Top-up orders')}</TableHead>
              <TableHead className='w-44'>{t('Submitted at')}</TableHead>
              <TableHead className='bg-muted sticky right-0 z-30 w-80 border-l pr-4 text-right shadow-[-6px_0_8px_-8px_var(--border)]'>
                {t('Actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.invoices.map((invoice) => {
              const isProcessing = invoice.status === 'processing'
              const isSelected = selectedIdSet.has(invoice.id)
              const orderNumbers = (invoice.orders || [])
                .map((order) => order.topup.trade_no)
                .join(', ')

              return (
                <TableRow
                  key={invoice.id}
                  data-state={isSelected ? 'selected' : undefined}
                >
                  <TableCell className='pl-4'>
                    <Checkbox
                      checked={isProcessing && isSelected}
                      disabled={!isProcessing || props.busy}
                      aria-label={t('Select row')}
                      onCheckedChange={(checked) => {
                        if (!checked) {
                          props.onSelectionChange(
                            props.selectedIds.filter((id) => id !== invoice.id)
                          )
                          return
                        }
                        props.onSelectionChange([
                          ...props.selectedIds,
                          invoice.id,
                        ])
                      }}
                    />
                  </TableCell>
                  <TableCell className='font-mono'>#{invoice.id}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(invoice.status)}>
                      {statusLabel(invoice.status, t)}
                    </Badge>
                  </TableCell>
                  <TableCell>{invoice.user_id}</TableCell>
                  <TableCell>
                    {t(
                      invoice.buyer_type === 'company' ? 'Unit' : 'Individual'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className='max-w-64 truncate font-medium'>
                      {invoice.title}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='max-w-56 truncate'>
                      {invoice.tax_number || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='max-w-64 truncate'>{invoice.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className='max-w-72 truncate' title={orderNumbers}>
                      {orderNumbers || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {invoice.create_time
                      ? new Date(invoice.create_time * 1000).toLocaleString()
                      : '-'}
                  </TableCell>
                  <TableCell className='bg-background group-data-[state=selected]:bg-muted sticky right-0 z-10 border-l pr-4 shadow-[-6px_0_8px_-8px_var(--border)]'>
                    <div className='flex justify-end gap-2'>
                      {invoice.status === 'pending' ? (
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={props.busy}
                          onClick={() => props.onProcess(invoice)}
                        >
                          <Icon
                            icon={CheckmarkCircle02Icon}
                            className='size-4'
                          />
                          {t('Start processing')}
                        </Button>
                      ) : null}
                      {isProcessing ? (
                        <>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  size='icon-sm'
                                  variant='outline'
                                  disabled={props.exporting}
                                  aria-label={t('Export order')}
                                  onClick={() => props.onExport([invoice])}
                                />
                              }
                            >
                              {props.exporting ? (
                                <Icon
                                  icon={Loading03Icon}
                                  className='size-4 animate-spin'
                                />
                              ) : (
                                <Icon
                                  icon={Download01Icon}
                                  className='size-4'
                                />
                              )}
                            </TooltipTrigger>
                            <TooltipContent>{t('Export order')}</TooltipContent>
                          </Tooltip>
                          <Button
                            size='sm'
                            disabled={props.busy}
                            onClick={() => props.onIssue(invoice)}
                          >
                            <Icon icon={FileCheckIcon} className='size-4' />
                            {t('Issue invoice')}
                          </Button>
                        </>
                      ) : null}
                      {invoice.status === 'pending' || isProcessing ? (
                        <Button
                          size='sm'
                          variant='destructive'
                          disabled={props.busy}
                          onClick={() => props.onReject(invoice)}
                        >
                          <Icon icon={Cancel01Icon} className='size-4' />
                          {t('Reject')}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TooltipProvider>
    </div>
  )
}

type RejectInvoiceDialogProps = {
  invoiceId: number | null
  reason: string
  busy: boolean
  onReasonChange: (reason: string) => void
  onClose: () => void
  onConfirm: (invoiceId: number) => void
}

export function RejectInvoiceDialog(props: RejectInvoiceDialogProps) {
  const { t } = useTranslation()
  const invoiceId = props.invoiceId
  if (invoiceId === null) return null

  return (
    <Dialog
      title={t('Reject invoice')}
      description={t('Explain why this request needs correction.')}
      open
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      contentClassName='sm:max-w-lg'
      footer={
        <Button
          variant='destructive'
          disabled={!props.reason.trim() || props.busy}
          onClick={() => props.onConfirm(invoiceId)}
        >
          {props.busy ? (
            <Icon icon={Loading03Icon} className='size-4 animate-spin' />
          ) : null}
          {t('Confirm rejection')}
        </Button>
      }
    >
      <Field>
        <FieldLabel htmlFor='reject-reason'>{t('Rejection reason')}</FieldLabel>
        <Textarea
          id='reject-reason'
          value={props.reason}
          maxLength={500}
          rows={5}
          onChange={(event) => props.onReasonChange(event.target.value)}
          placeholder={t('Explain why this request needs correction.')}
        />
      </Field>
    </Dialog>
  )
}

function AdminInvoices() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [fileURL, setFileURL] = useState('')
  const [number, setNumber] = useState('')
  const [reason, setReason] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([])
  const fileURLIsValid = (() => {
    try {
      const parsedURL = new URL(fileURL)
      return parsedURL.protocol === 'https:' && parsedURL.hostname !== ''
    } catch {
      return false
    }
  })()
  const settingsQuery = useQuery({
    queryKey: ['admin-invoice-settings'],
    queryFn: getInvoiceSettings,
  })
  const [interval, setInterval] = useState<number | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const serverInterval = settingsQuery.data?.interval_days ?? 0
  const currentInterval = interval ?? serverInterval
  const serverDescription = settingsQuery.data?.description ?? ''
  const currentDescription = description ?? serverDescription
  const query = useQuery({
    queryKey: ['admin-invoices', status, page],
    queryFn: () => getAdminInvoices(page, status),
  })
  const actionMutation = useMutation({
    mutationFn: (action: {
      type: 'process' | 'issue' | 'reject'
      id: number
    }) => {
      if (action.type === 'process') return processInvoice(action.id)
      if (action.type === 'reject') return rejectInvoice(action.id, reason)
      return issueInvoice(action.id, {
        invoice_number: number,
        file_url: fileURL,
      })
    },
    onSuccess: () => {
      toast.success(t('Operation successful'))
      setSelected(null)
      setFileURL('')
      setNumber('')
      setReason('')
      setSelectedInvoiceIds([])
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] })
    },
    onError: (error) =>
      toast.error(
        t(error instanceof Error ? error.message : 'Something went wrong!')
      ),
  })
  const settingsMutation = useMutation({
    mutationFn: (settings: { intervalDays: number; description: string }) =>
      updateInvoiceSettings(settings.intervalDays, settings.description),
    onSuccess: () => {
      toast.success(t('Saved successfully'))
      setInterval(null)
      setDescription(null)
      queryClient.invalidateQueries({ queryKey: ['admin-invoice-settings'] })
    },
    onError: (error) =>
      toast.error(
        t(error instanceof Error ? error.message : 'Something went wrong!')
      ),
  })
  const items = query.data?.items || []
  const selectedProcessingInvoices = items.filter(
    (invoice) =>
      invoice.status === 'processing' && selectedInvoiceIds.includes(invoice.id)
  )
  const handleExport = async (invoices: Invoice[]) => {
    setIsExporting(true)
    try {
      const exported = await exportProcessingInvoices(invoices, t)
      if (!exported) {
        toast.info(t('No invoices to export'))
      }
    } catch {
      toast.error(t('Failed to export invoices'))
    } finally {
      setIsExporting(false)
    }
  }
  let invoiceContent: React.ReactNode
  if (query.isLoading) {
    invoiceContent = (
      <div className='text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm'>
        <Icon icon={Loading03Icon} className='size-4 animate-spin' />
        {t('Loading...')}
      </div>
    )
  } else if (items.length === 0) {
    invoiceContent = (
      <Empty className='min-h-64 border'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <Icon icon={FileIcon} />
          </EmptyMedia>
          <EmptyTitle>{t('No invoice requests match this filter.')}</EmptyTitle>
          <EmptyDescription>
            {t('New requests will appear here when users submit them.')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else {
    invoiceContent = (
      <AdminInvoiceTable
        invoices={items}
        selectedIds={selectedInvoiceIds}
        busy={actionMutation.isPending}
        exporting={isExporting}
        onSelectionChange={setSelectedInvoiceIds}
        onExport={handleExport}
        onProcess={(invoice) =>
          actionMutation.mutate({ type: 'process', id: invoice.id })
        }
        onIssue={setSelected}
        onReject={(invoice) => setSelected({ ...invoice, status: 'rejecting' })}
      />
    )
  }
  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>
        {t('Invoice Management')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Dialog
          title={t('Settings')}
          trigger={
            <Button variant='outline'>
              <Settings2 className='size-4' />
              {t('Settings')}
            </Button>
          }
          contentClassName='sm:max-w-2xl'
        >
          <Card>
            <CardContent className='p-5'>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor='invoice-notice'>
                    {t('Invoice notice')}
                  </FieldLabel>
                  <Textarea
                    id='invoice-notice'
                    value={currentDescription}
                    maxLength={2000}
                    rows={4}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('Enter an optional notice for users')}
                  />
                  <FieldDescription>
                    {t(
                      'This notice is shown to users above the invoice request form.'
                    )}
                  </FieldDescription>
                </Field>
                <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
                  <Field className='sm:max-w-xs'>
                    <FieldLabel>{t('Invoice request interval')}</FieldLabel>
                    <Select
                      value={String(currentInterval)}
                      onValueChange={(value) =>
                        value && setInterval(Number(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {invoiceIntervalLabel(currentInterval, t)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value='0'>
                            {t('No frequency limit')}
                          </SelectItem>
                          <SelectItem value='15'>
                            {t('Every 15 days')}
                          </SelectItem>
                          <SelectItem value='30'>
                            {t('Every 30 days')}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {t(
                        'Control how often a user can submit a new invoice request.'
                      )}
                    </FieldDescription>
                  </Field>
                  <Button
                    disabled={
                      ((interval === null || interval === serverInterval) &&
                        (description === null ||
                          description === serverDescription)) ||
                      settingsMutation.isPending
                    }
                    onClick={() =>
                      settingsMutation.mutate({
                        intervalDays: currentInterval,
                        description: currentDescription,
                      })
                    }
                  >
                    {settingsMutation.isPending && (
                      <Icon
                        icon={Loading03Icon}
                        className='size-4 animate-spin'
                      />
                    )}
                    {t('Save Changes')}
                  </Button>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </Dialog>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='h-full min-h-0 space-y-6 overflow-y-auto overscroll-contain pr-1'>
          <div className='border-b pb-5'>
            <div className='text-muted-foreground mb-1 flex items-center gap-2 text-sm font-medium'>
              <Icon icon={FileCheckIcon} className='size-4' />
              {t('Admin invoice queue')}
            </div>
            <p className='text-muted-foreground text-sm'>
              {t('Review and issue invoices submitted by users.')}
            </p>
          </div>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h2 className='text-base font-semibold'>
                {t('Invoice requests')}
              </h2>
              <p className='text-muted-foreground text-sm'>
                {t('Review incoming requests and attach issued invoice files.')}
              </p>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <Select
                value={status || 'all'}
                onValueChange={(value) => {
                  setPage(1)
                  setSelectedInvoiceIds([])
                  setStatus(value === 'all' ? '' : value || '')
                }}
              >
                <SelectTrigger className='w-full sm:w-48'>
                  <SelectValue>
                    {status ? statusLabel(status, t) : t('All statuses')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value='all'>{t('All statuses')}</SelectItem>
                    <SelectItem value='pending'>{t('Pending')}</SelectItem>
                    <SelectItem value='processing'>
                      {t('Processing')}
                    </SelectItem>
                    <SelectItem value='issued'>{t('Issued')}</SelectItem>
                    <SelectItem value='rejected'>{t('Rejected')}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                variant='outline'
                disabled={
                  isExporting || selectedProcessingInvoices.length === 0
                }
                onClick={() => handleExport(selectedProcessingInvoices)}
              >
                {isExporting ? (
                  <Icon icon={Loading03Icon} className='size-4 animate-spin' />
                ) : (
                  <Icon icon={Download01Icon} className='size-4' />
                )}
                {t(isExporting ? 'Exporting...' : 'Export')}
              </Button>
              <Button
                variant='outline'
                size='icon'
                aria-label={t('Refresh')}
                disabled={query.isFetching}
                onClick={() => {
                  setSelectedInvoiceIds([])
                  void query.refetch()
                }}
              >
                <Icon
                  icon={Refresh01Icon}
                  className={
                    query.isFetching ? 'size-4 animate-spin' : 'size-4'
                  }
                />
              </Button>
            </div>
          </div>
          {invoiceContent}
          {(query.data?.total || 0) > 50 && (
            <Pagination
              page={page}
              total={query.data?.total || 0}
              pageSize={50}
              loading={query.isFetching}
              onPageChange={(nextPage) => {
                setSelectedInvoiceIds([])
                setPage(nextPage)
              }}
            />
          )}
          {selected?.status === 'processing' && (
            <Dialog
              title={t('Issue invoice')}
              open
              onOpenChange={(open) => {
                if (!open) {
                  setSelected(null)
                  setFileURL('')
                  setNumber('')
                }
              }}
              contentClassName='sm:max-w-lg'
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor='invoice-number'>
                    {t('Invoice number')}
                  </FieldLabel>
                  <Input
                    id='invoice-number'
                    value={number}
                    maxLength={100}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder={t('Enter the invoice number')}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor='invoice-file'>
                    {t('File URL')}
                  </FieldLabel>
                  <Input
                    id='invoice-file'
                    type='url'
                    value={fileURL}
                    maxLength={4096}
                    aria-invalid={fileURL !== '' && !fileURLIsValid}
                    onChange={(e) => setFileURL(e.target.value)}
                    placeholder={t('Enter the hosted invoice file URL')}
                  />
                  {fileURL !== '' && !fileURLIsValid && (
                    <FieldDescription className='text-destructive'>
                      {t('Invoice file URL must use HTTPS')}
                    </FieldDescription>
                  )}
                </Field>
                <Button
                  disabled={
                    !number || !fileURLIsValid || actionMutation.isPending
                  }
                  onClick={() =>
                    actionMutation.mutate({
                      type: 'issue',
                      id: selected.id,
                    })
                  }
                >
                  {actionMutation.isPending && (
                    <Icon
                      icon={Loading03Icon}
                      className='size-4 animate-spin'
                    />
                  )}
                  {t('Mark as issued')}
                </Button>
              </FieldGroup>
            </Dialog>
          )}
          <RejectInvoiceDialog
            invoiceId={selected?.status === 'rejecting' ? selected.id : null}
            reason={reason}
            busy={actionMutation.isPending}
            onReasonChange={setReason}
            onClose={() => {
              setSelected(null)
              setReason('')
            }}
            onConfirm={(invoiceId) =>
              actionMutation.mutate({ type: 'reject', id: invoiceId })
            }
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

export function Invoices() {
  const role = useAuthStore((s) => s.auth.user?.role ?? 0)
  return role >= ROLE.ADMIN ? <AdminInvoices /> : <InvoiceForm />
}
