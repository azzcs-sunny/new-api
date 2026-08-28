package controller

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeInvoiceBuyerDetailsClearsIndividualCompanyFields(t *testing.T) {
	req := createInvoiceRequest{
		BuyerType:   "individual",
		TaxNumber:   "tax-number",
		Address:     "registered address",
		Phone:       "123456",
		BankName:    "bank",
		BankAccount: "account",
	}

	normalizeInvoiceBuyerDetails(&req)

	assert.Empty(t, req.TaxNumber)
	assert.Empty(t, req.Address)
	assert.Empty(t, req.Phone)
	assert.Empty(t, req.BankName)
	assert.Empty(t, req.BankAccount)
}

func TestValidateInvoiceFileURLRequiresHTTPSHost(t *testing.T) {
	testCases := []struct {
		name    string
		fileURL string
		wantErr bool
	}{
		{name: "https URL", fileURL: "https://files.example.com/invoice.pdf"},
		{name: "http URL", fileURL: "http://files.example.com/invoice.pdf", wantErr: true},
		{name: "missing host", fileURL: "https:invoice.pdf", wantErr: true},
		{name: "oversized URL", fileURL: "https://example.com/" + strings.Repeat("a", 4096), wantErr: true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateInvoiceFileURL(tc.fileURL)
			if tc.wantErr {
				require.EqualError(t, err, "Invoice file URL must use HTTPS")
				return
			}
			require.NoError(t, err)
		})
	}
}
