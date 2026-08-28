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
import { api } from '@/lib/api'

import type {
  ApiResponse,
  EligibleInvoiceOrders,
  Invoice,
  InvoiceSettings,
  PageResponse,
} from './types'

function unwrapResponse<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new Error(response.message || 'Something went wrong!')
  }
  return response.data
}

export async function getEligibleOrders(page = 1) {
  const res = await api.get<ApiResponse<EligibleInvoiceOrders>>(
    '/api/user/invoices/eligible-orders',
    { params: { p: page, page_size: 20 } }
  )
  return unwrapResponse(res.data)
}

export async function getInvoices(page = 1) {
  const res = await api.get<ApiResponse<PageResponse<Invoice>>>(
    '/api/user/invoices',
    { params: { p: page, page_size: 20 } }
  )
  return unwrapResponse(res.data)
}

export async function createInvoice(data: Record<string, unknown>) {
  const res = await api.post<ApiResponse<Invoice>>('/api/user/invoices', data)
  return unwrapResponse(res.data)
}

export async function getAdminInvoices(page = 1, status = '', pageSize = 50) {
  const res = await api.get<ApiResponse<PageResponse<Invoice>>>(
    '/api/invoice/admin',
    { params: { p: page, page_size: pageSize, status } }
  )
  return unwrapResponse(res.data)
}

export async function getInvoiceSettings() {
  const res = await api.get<ApiResponse<InvoiceSettings>>(
    '/api/invoice/admin/settings'
  )
  return unwrapResponse(res.data)
}

export async function updateInvoiceSettings(
  intervalDays: number,
  description: string
) {
  const res = await api.put<ApiResponse<InvoiceSettings>>(
    '/api/invoice/admin/settings',
    {
      interval_days: intervalDays,
      description,
    }
  )
  return unwrapResponse(res.data)
}

export async function processInvoice(id: number) {
  const res = await api.post<ApiResponse<null>>(
    `/api/invoice/admin/${id}/process`
  )
  unwrapResponse(res.data)
}

export async function issueInvoice(
  id: number,
  data: { invoice_number: string; file_url: string }
) {
  const res = await api.post<ApiResponse<null>>(
    `/api/invoice/admin/${id}/issue`,
    data
  )
  unwrapResponse(res.data)
}

export async function rejectInvoice(id: number, reason: string) {
  const res = await api.post<ApiResponse<null>>(
    `/api/invoice/admin/${id}/reject`,
    { reason }
  )
  unwrapResponse(res.data)
}
