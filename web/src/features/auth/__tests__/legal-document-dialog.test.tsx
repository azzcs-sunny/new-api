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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'

import { LegalConsent } from '../components/legal-consent'
import { TermsFooter } from '../components/terms-footer'
import type { SystemStatus } from '../types'

const status = {
  legal_terms_of_service: 'Configured terms content',
  legal_terms_of_service_updated_at: 1787529600,
} satisfies SystemStatus

describe('legal document dialogs', () => {
  test.each([
    {
      name: 'consent checkbox',
      renderDialog: () =>
        render(
          <LegalConsent
            status={status}
            checked={false}
            onCheckedChange={() => undefined}
          />
        ),
    },
    {
      name: 'auth page footer',
      renderDialog: () => render(<TermsFooter status={status} />),
    },
  ])(
    '$name shows the saved document update date in its dialog',
    async (testCase) => {
      const user = userEvent.setup()
      testCase.renderDialog()

      await user.click(screen.getByRole('button', { name: 'Terms of Service' }))

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Last updated: 2026-08-24')).toBeInTheDocument()
      expect(screen.getByText('Configured terms content')).toBeInTheDocument()
    }
  )

  test('footer omits documents that have no saved content', () => {
    render(
      <TermsFooter
        status={{
          legal_terms_of_service: 'Configured terms content',
          legal_usage_policy: '',
        }}
      />
    )

    expect(
      screen.getByRole('button', { name: 'Terms of Service' })
    ).toBeInTheDocument()
    expect(screen.queryByText('Usage Policy')).toBeNull()
  })

  test('dialog renders escaped newline sequences as Markdown line breaks', async () => {
    const user = userEvent.setup()
    render(
      <TermsFooter
        status={{
          legal_terms_of_service: '# Agreement title\\n\\nAgreement body',
          legal_terms_of_service_updated_at: 1787529600,
        }}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Terms of Service' }))

    expect(
      screen.getByRole('heading', { name: 'Agreement title' })
    ).toBeInTheDocument()
    expect(screen.getByText('Agreement body')).toBeInTheDocument()
  })
})
