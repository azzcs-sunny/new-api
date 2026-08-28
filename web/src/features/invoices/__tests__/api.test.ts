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
import { beforeEach, describe, expect, test, vi } from 'vitest'

const { getMock, postMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: {
    get: getMock,
    post: postMock,
    put: putMock,
  },
}))

const {
  getAdminInvoices,
  getEligibleOrders,
  processInvoice,
  updateInvoiceSettings,
} =
  await import('../api')

describe('invoice API', () => {
  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
    putMock.mockReset()
  })

  test('returns eligible order availability from a successful response', async () => {
    const availability = {
      items: [],
      interval_days: 30,
      description: '',
      can_submit: false,
      next_available_at: 1_800_000_000,
    }
    getMock.mockResolvedValue({
      data: { success: true, message: '', data: availability },
    })

    await expect(getEligibleOrders(2)).resolves.toEqual(availability)
    expect(getMock).toHaveBeenCalledWith('/api/user/invoices/eligible-orders', {
      params: { p: 2, page_size: 20 },
    })
  })

  test('uses the requested page size for admin invoice queries', async () => {
    const invoices = { page: 2, page_size: 100, total: 0, items: [] }
    getMock.mockResolvedValue({
      data: { success: true, message: '', data: invoices },
    })

    await expect(getAdminInvoices(2, 'pending', 100)).resolves.toEqual(
      invoices
    )
    expect(getMock).toHaveBeenCalledWith('/api/invoice/admin', {
      params: { p: 2, page_size: 100, status: 'pending' },
    })
  })

  test('rejects an admin action when the API reports a business failure', async () => {
    postMock.mockResolvedValue({
      data: {
        success: false,
        message: 'invoice status transition is invalid',
        data: null,
      },
    })

    await expect(processInvoice(42)).rejects.toThrow(
      'invoice status transition is invalid'
    )
  })

  test('persists one of the supported request intervals', async () => {
    putMock.mockResolvedValue({
      data: {
        success: true,
        message: '',
        data: {
          interval_days: 15,
          description: 'Invoice requests are reviewed weekly.',
        },
      },
    })

    await expect(
      updateInvoiceSettings(15, 'Invoice requests are reviewed weekly.')
    ).resolves.toEqual({
      interval_days: 15,
      description: 'Invoice requests are reviewed weekly.',
    })
    expect(putMock).toHaveBeenCalledWith('/api/invoice/admin/settings', {
      interval_days: 15,
      description: 'Invoice requests are reviewed weekly.',
    })
  })
})
