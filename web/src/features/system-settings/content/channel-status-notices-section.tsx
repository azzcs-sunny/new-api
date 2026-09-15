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
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { StaticRowActions } from '@/components/data-table/static/static-row-actions'
import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  CHANNEL_TYPES,
  CHANNEL_TYPE_OPTIONS,
} from '@/features/channels/constants'

import { SettingsSwitchField } from '../components/settings-form-layout'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const noticeLevelSchema = z.enum(['normal', 'warning', 'error'])

const storedNoticeSchema = z.object({
  channel_type: z.number().int().positive(),
  level: noticeLevelSchema,
  content: z.string(),
  enabled: z.boolean(),
})

const storedNoticesSchema = z.array(storedNoticeSchema)

const noticeFormSchema = storedNoticeSchema.extend({
  channel_type: z.number().int().positive('Platform is required'),
  content: z
    .string()
    .trim()
    .min(1, 'Notice content is required')
    .max(200, 'Notice content must be at most 200 characters'),
})

type ChannelStatusNotice = z.infer<typeof storedNoticeSchema>
type NoticeFormValues = z.infer<typeof noticeFormSchema>

type ChannelStatusNoticesSectionProps = {
  data: string
}

const NOTICE_FORM_ID = 'channel-status-notice-form'

const levelOptions = [
  { value: 'normal', label: 'Normal', variant: 'info' as const },
  { value: 'warning', label: 'Warning', variant: 'warning' as const },
  { value: 'error', label: 'Error', variant: 'danger' as const },
] satisfies Array<{
  value: ChannelStatusNotice['level']
  label: string
  variant: 'info' | 'warning' | 'danger'
}>

export function ChannelStatusNoticesSection(
  props: ChannelStatusNoticesSectionProps
) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [notices, setNotices] = useState<ChannelStatusNotice[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingChannelType, setEditingChannelType] = useState<number | null>(
    null
  )
  const [deleteTarget, setDeleteTarget] = useState<ChannelStatusNotice | null>(
    null
  )

  const form = useForm<NoticeFormValues>({
    resolver: zodResolver(noticeFormSchema),
    defaultValues: {
      channel_type: CHANNEL_TYPE_OPTIONS[0]?.value ?? 1,
      level: 'normal',
      content: '',
      enabled: true,
    },
  })

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(props.data || '[]')
      const result = storedNoticesSchema.safeParse(parsed)
      setNotices(result.success ? result.data : [])
    } catch {
      setNotices([])
    }
    setHasChanges(false)
  }, [props.data])

  const usedChannelTypes = new Set(notices.map((notice) => notice.channel_type))
  const firstAvailableChannelType = CHANNEL_TYPE_OPTIONS.find(
    (option) => !usedChannelTypes.has(option.value)
  )?.value

  function handleAdd() {
    if (firstAvailableChannelType === undefined) return
    setEditingChannelType(null)
    form.reset({
      channel_type: firstAvailableChannelType,
      level: 'normal',
      content: '',
      enabled: true,
    })
    setShowDialog(true)
  }

  function handleEdit(notice: ChannelStatusNotice) {
    setEditingChannelType(notice.channel_type)
    form.reset(notice)
    setShowDialog(true)
  }

  function handleSubmit(values: NoticeFormValues) {
    const notice = { ...values, content: values.content.trim() }
    if (editingChannelType === null) {
      setNotices((current) => [...current, notice])
      toast.success(t('Notice added. Save settings to apply.'))
    } else {
      setNotices((current) =>
        current.map((item) =>
          item.channel_type === editingChannelType ? notice : item
        )
      )
      toast.success(t('Notice updated. Save settings to apply.'))
    }
    setHasChanges(true)
    setShowDialog(false)
  }

  function handleDelete() {
    if (!deleteTarget) return
    setNotices((current) =>
      current.filter(
        (notice) => notice.channel_type !== deleteTarget.channel_type
      )
    )
    setDeleteTarget(null)
    setHasChanges(true)
    toast.success(t('Notice deleted. Save settings to apply.'))
  }

  function handleSave() {
    updateOption.mutate(
      {
        key: 'console_setting.channel_status_notices',
        value: JSON.stringify(
          [...notices].sort(
            (left, right) => left.channel_type - right.channel_type
          )
        ),
      },
      { onSuccess: () => setHasChanges(false) }
    )
  }

  return (
    <SettingsSection title={t('Channel status notices')}>
      <div className='space-y-4'>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Show one editable notice in the upper-right corner of each channel platform group.'
          )}
        </p>
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            onClick={handleAdd}
            size='sm'
            disabled={firstAvailableChannelType === undefined}
          >
            <Plus aria-hidden='true' />
            {t('Add notice')}
          </Button>
          <Button
            onClick={handleSave}
            size='sm'
            variant='secondary'
            disabled={!hasChanges || updateOption.isPending}
          >
            <Save aria-hidden='true' />
            {updateOption.isPending ? t('Saving...') : t('Save Settings')}
          </Button>
        </div>

        <StaticDataTable
          data={[...notices].sort(
            (left, right) => left.channel_type - right.channel_type
          )}
          getRowKey={(notice) => notice.channel_type}
          emptyContent={t('No channel status notices configured.')}
          columns={[
            {
              id: 'platform',
              header: t('Platform'),
              cell: (notice) =>
                t(
                  CHANNEL_TYPES[
                    notice.channel_type as keyof typeof CHANNEL_TYPES
                  ] ?? 'Unknown'
                ),
            },
            {
              id: 'level',
              header: t('Type'),
              cell: (notice) => {
                const option = levelOptions.find(
                  (item) => item.value === notice.level
                )
                return (
                  <StatusBadge
                    label={t(option?.label ?? 'Normal')}
                    variant={option?.variant ?? 'info'}
                    copyable={false}
                  />
                )
              },
            },
            {
              id: 'content',
              header: t('Content'),
              cellClassName: 'max-w-md truncate',
              cell: (notice) => notice.content,
            },
            {
              id: 'enabled',
              header: t('Status'),
              cell: (notice) => (
                <StatusBadge
                  label={notice.enabled ? t('Enabled') : t('Disabled')}
                  variant={notice.enabled ? 'success' : 'neutral'}
                  copyable={false}
                />
              ),
            },
            {
              id: 'actions',
              header: t('Actions'),
              className: 'text-right',
              cell: (notice) => (
                <StaticRowActions
                  editLabel={t('Edit')}
                  deleteLabel={t('Delete')}
                  menuLabel={t('Open menu')}
                  onEdit={() => handleEdit(notice)}
                  onDelete={() => setDeleteTarget(notice)}
                />
              ),
            },
          ]}
        />
      </div>

      <Dialog
        open={showDialog}
        onOpenChange={setShowDialog}
        title={editingChannelType === null ? t('Add notice') : t('Edit notice')}
        description={t(
          'The notice appears next to the matching platform on the channel status page.'
        )}
        footer={
          <>
            <Button
              type='button'
              variant='outline'
              onClick={() => setShowDialog(false)}
            >
              {t('Cancel')}
            </Button>
            <Button type='submit' form={NOTICE_FORM_ID}>
              {editingChannelType === null ? t('Add') : t('Save')}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form
            id={NOTICE_FORM_ID}
            className='space-y-5'
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <FormField
              control={form.control}
              name='channel_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Platform')}</FormLabel>
                  <Select
                    items={CHANNEL_TYPE_OPTIONS.map((option) => ({
                      value: String(option.value),
                      label: t(option.label),
                    }))}
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder={t('Select platform')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {CHANNEL_TYPE_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={String(option.value)}
                            disabled={
                              option.value !== editingChannelType &&
                              usedChannelTypes.has(option.value)
                            }
                          >
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='level'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Notice type')}</FormLabel>
                  <Select
                    items={levelOptions.map((option) => ({
                      value: option.value,
                      label: t(option.label),
                    }))}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder={t('Select notice type')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {levelOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='content'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Notice content')}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      maxLength={200}
                      placeholder={t('Enter a short channel status message')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='enabled'
              render={({ field }) => (
                <SettingsSwitchField
                  controlId='channel-status-notice-enabled'
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  label={t('Show this notice')}
                  description={t(
                    'Disabled notices remain saved but are hidden from the status page.'
                  )}
                />
              )}
            />
          </form>
        </Form>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('Delete notice')}
        desc={t('This notice will be removed after you save the settings.')}
        confirmText={t('Delete')}
        destructive
        handleConfirm={handleDelete}
      />
    </SettingsSection>
  )
}
