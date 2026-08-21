/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'

import {
  NotificationPanel,
  type AnnouncementItem,
} from './notification-popover'

interface NotificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeTab: 'notice' | 'announcements'
  onTabChange: (tab: 'notice' | 'announcements') => void
  notice: string
  announcements: AnnouncementItem[]
  loading: boolean
}

export function NotificationDialog({
  open,
  onOpenChange,
  activeTab,
  onTabChange,
  notice,
  announcements,
  loading,
}: NotificationDialogProps) {
  const { t } = useTranslation()

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen, details) => {
        // The mandatory prompt can only be dismissed with its explicit button.
        if (!nextOpen && details.reason !== 'close-press') return
        onOpenChange(nextOpen)
      }}
    >
      <AlertDialogContent
        size='default'
        className='max-h-[calc(100vh-2rem)] w-[min(42rem,calc(100%-2rem))] !max-w-none gap-0 overflow-hidden p-0 shadow-xl'
      >
        <div className='bg-muted/40 flex items-start gap-3 p-5 sm:gap-4 sm:p-6'>
          <div className='bg-background ring-foreground/10 flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1'>
            <Megaphone className='text-primary size-5' aria-hidden='true' />
          </div>
          <div className='flex min-w-0 flex-col gap-1.5 pt-0.5'>
            <AlertDialogTitle className='text-lg leading-tight font-semibold'>
              {t('System Announcements')}
            </AlertDialogTitle>
            <AlertDialogDescription className='text-start text-sm text-pretty'>
              {t('Latest platform updates and notices')}
            </AlertDialogDescription>
          </div>
        </div>
        <Separator />
        <div className='min-h-0 p-4 sm:p-6'>
          <NotificationPanel
            activeTab={activeTab}
            onTabChange={onTabChange}
            notice={notice}
            announcements={announcements}
            loading={loading}
            showHeader={false}
            contentClassName='h-[min(46vh,26rem)]'
          />
        </div>
        <AlertDialogFooter className='m-0 rounded-none px-4 py-3 sm:px-6 sm:py-4'>
          <AlertDialogCancel className='sm:min-w-24'>
            {t('Close')}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
