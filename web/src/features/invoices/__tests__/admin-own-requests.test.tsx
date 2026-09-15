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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { Invoices } from '../index'

const { mockStatus } = vi.hoisted(() => ({
  mockStatus: vi.fn(),
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({
    status: mockStatus(),
    loading: false,
    error: null,
  }),
}))

vi.mock('../api', () => ({
  createInvoice: vi.fn(),
  getAdminInvoices: vi.fn().mockResolvedValue({
    page: 1,
    page_size: 50,
    total: 0,
    items: [],
  }),
  getEligibleOrders: vi.fn().mockResolvedValue({
    items: [],
    interval_days: 0,
    description: '',
    can_submit: true,
    next_available_at: 0,
    total: 0,
  }),
  getInvoiceSettings: vi.fn().mockResolvedValue({
    interval_days: 0,
    description: '',
  }),
  getInvoices: vi.fn().mockResolvedValue({
    page: 1,
    page_size: 20,
    total: 0,
    items: [],
  }),
  issueInvoice: vi.fn(),
  processInvoice: vi.fn(),
  rejectInvoice: vi.fn(),
  updateInvoiceSettings: vi.fn(),
}))

function renderInvoices(
  adminSidebarConfig: object,
  initialTab?: 'management' | 'mine'
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  mockStatus.mockReturnValue({
    SidebarModulesAdmin: JSON.stringify(adminSidebarConfig),
  })
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'admin',
    role: ROLE.ADMIN,
  })

  function Wrapper(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    )
  }

  return render(<Invoices initialTab={initialTab} />, { wrapper: Wrapper })
}

describe('admin invoice own requests', () => {
  beforeEach(() => {
    mockStatus.mockReset()
  })

  afterEach(() => {
    useAuthStore.getState().auth.reset()
  })

  test('shows the admin own-request tab when the invoice module is enabled', () => {
    renderInvoices({ personal: { enabled: true, invoices: true } }, 'mine')

    expect(
      screen.getByRole('tab', { name: 'Invoice Management' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'My invoice requests' })
    ).toHaveAttribute('aria-selected', 'true')
  })

  test('hides the admin own-request tab when the invoice module is disabled', () => {
    renderInvoices({ personal: { enabled: true, invoices: false } })

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: 'My invoice requests' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Invoice requests')).toBeInTheDocument()
  })
})
