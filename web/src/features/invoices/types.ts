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
export type InvoiceOrder = {
  topup_id: number
  trade_no: string
  amount: number
  money: number
  create_time: number
}

export type Invoice = {
  id: number
  user_id: number
  invoice_type: string
  buyer_type: string
  title: string
  tax_number: string
  email: string
  phone: string
  address: string
  bank_name: string
  bank_account: string
  amount: number
  status: string
  reject_reason: string
  invoice_number: string
  file_url: string
  create_time: number
  issue_time: number
  orders?: Array<{
    id: number
    invoice_id: number
    topup_id: number
    topup: {
      trade_no: string
      money: number
      create_time: number
    }
  }>
}

export type PageResponse<T> = {
  page: number
  page_size: number
  total: number
  items: T[]
}

export type ApiResponse<T = unknown> = {
  success: boolean
  message: string
  data: T
}

export type EligibleInvoiceOrders = {
  page: number
  page_size: number
  total: number
  items: InvoiceOrder[]
  interval_days: number
  description: string
  can_submit: boolean
  next_available_at: number
}

export type InvoiceSettings = {
  interval_days: number
  description: string
}
