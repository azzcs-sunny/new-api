/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { isCommunityLink } from '@/lib/community-link'

import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import {
  SettingsForm,
  SettingsFormGrid,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'

type CommunitySettingsValues = {
  general_setting: {
    qq_group_url: string
    qq_group_name: string
    qq_group_number: string
    telegram_url: string
    telegram_name: string
    customer_service_qq: string
  }
}

export function CommunitySettingsSection(props: {
  defaultValues: CommunitySettingsValues
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const link = z
    .string()
    .trim()
    .refine(isCommunityLink, {
      message: t('Enter a valid HTTP(S) link without credentials'),
    })
  const schema = z.object({
    general_setting: z.object({
      qq_group_url: link,
      qq_group_name: z.string().trim(),
      qq_group_number: z.string().trim(),
      telegram_url: link,
      telegram_name: z.string().trim(),
      customer_service_qq: z.string().trim(),
    }),
  })
  const { form, handleSubmit, handleReset, isDirty, isSubmitting } =
    useSettingsForm<CommunitySettingsValues>({
      resolver: zodResolver(schema),
      defaultValues: props.defaultValues,
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          await updateOption.mutateAsync({ key, value: String(value) })
        }
      },
    })
  const fields = [
    { name: 'qq_group_url', label: t('QQ Group Link') },
    { name: 'qq_group_name', label: t('QQ Group Name') },
    { name: 'qq_group_number', label: t('QQ Group Number') },
    { name: 'telegram_url', label: t('Telegram Link') },
    { name: 'telegram_name', label: t('Telegram Name') },
    { name: 'customer_service_qq', label: t('Wallet Customer Service QQ') },
  ] as const

  return (
    <>
      <FormNavigationGuard when={isDirty} />
      <SettingsSection title={t('Community and Support')}>
        <Form {...form}>
          <SettingsForm onSubmit={handleSubmit}>
            <SettingsPageFormActions
              onSave={handleSubmit}
              onReset={handleReset}
              isSaving={isSubmitting}
              isResetDisabled={!isDirty}
            />
            <FormDirtyIndicator isDirty={isDirty} />
            <SettingsFormGrid>
              {fields.map((item) => (
                <FormField
                  key={item.name}
                  control={form.control}
                  name={`general_setting.${item.name}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{item.label}</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </SettingsFormGrid>
          </SettingsForm>
        </Form>
      </SettingsSection>
    </>
  )
}
