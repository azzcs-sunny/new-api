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
package controller

import (
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/mail"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type createInvoiceRequest struct {
	OrderIds    []int  `json:"order_ids"`
	InvoiceType string `json:"invoice_type"`
	BuyerType   string `json:"buyer_type"`
	Title       string `json:"title"`
	TaxNumber   string `json:"tax_number"`
	Email       string `json:"email"`
	Phone       string `json:"phone"`
	Address     string `json:"address"`
	BankName    string `json:"bank_name"`
	BankAccount string `json:"bank_account"`
}

func normalizeInvoiceBuyerDetails(req *createInvoiceRequest) {
	if req.BuyerType != "individual" {
		return
	}
	req.TaxNumber = ""
	req.Address = ""
	req.Phone = ""
	req.BankName = ""
	req.BankAccount = ""
}

func validateInvoiceFileURL(fileURL string) error {
	if len(fileURL) > 4096 {
		return errors.New("Invoice file URL must use HTTPS")
	}
	parsedURL, err := url.ParseRequestURI(fileURL)
	if err != nil || parsedURL.Scheme != "https" || parsedURL.Host == "" {
		return errors.New("Invoice file URL must use HTTPS")
	}
	return nil
}

const maxInvoiceAttachmentSize = 20 << 20

func downloadInvoiceAttachment(fileURL string) ([]byte, string, error) {
	parsedURL, err := url.ParseRequestURI(fileURL)
	if err != nil {
		return nil, "", errors.New("Invalid invoice file URL")
	}
	client := &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(req *http.Request, _ []*http.Request) error {
		if req.URL.Scheme != "https" {
			return errors.New("Invoice file redirect must use HTTPS")
		}
		return nil
	}}
	response, err := client.Get(parsedURL.String())
	if err != nil {
		return nil, "", fmt.Errorf("failed to download invoice file: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, "", fmt.Errorf("invoice file returned HTTP %d", response.StatusCode)
	}
	if response.ContentLength > maxInvoiceAttachmentSize {
		return nil, "", errors.New("Invoice file is too large")
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, maxInvoiceAttachmentSize+1))
	if err != nil {
		return nil, "", fmt.Errorf("failed to read invoice file: %w", err)
	}
	if len(data) > maxInvoiceAttachmentSize {
		return nil, "", errors.New("Invoice file is too large")
	}
	filename := path.Base(parsedURL.Path)
	if filename == "." || filename == "/" || filename == "" || strings.ContainsAny(filename, "\\\r\n\"") {
		filename = "invoice.pdf"
	}
	return data, filename, nil
}

func GetEligibleInvoiceOrders(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetEligibleInvoiceOrdersPaged(c.GetInt("id"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	canSubmit, nextAvailableAt, err := model.GetInvoiceRequestAvailability(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, gin.H{"page": pageInfo.Page, "page_size": pageInfo.PageSize, "total": pageInfo.Total, "items": pageInfo.Items, "interval_days": model.InvoiceFrequencyDays(), "description": model.InvoiceRequestDescription(), "can_submit": canSubmit, "next_available_at": nextAvailableAt})
}

func GetUserInvoices(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	invoices, total, err := model.GetUserInvoices(c.GetInt("id"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(invoices)
	common.ApiSuccess(c, pageInfo)
}

func CreateInvoice(c *gin.Context) {
	var req createInvoiceRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "Invalid invoice request")
		return
	}
	req.InvoiceType = strings.TrimSpace(req.InvoiceType)
	req.BuyerType = strings.TrimSpace(req.BuyerType)
	req.Title = strings.TrimSpace(req.Title)
	req.TaxNumber = strings.TrimSpace(req.TaxNumber)
	req.Email = strings.TrimSpace(req.Email)
	req.Phone = strings.TrimSpace(req.Phone)
	req.Address = strings.TrimSpace(req.Address)
	req.BankName = strings.TrimSpace(req.BankName)
	req.BankAccount = strings.TrimSpace(req.BankAccount)
	if len(req.OrderIds) == 0 ||
		len(req.Title) == 0 || len(req.Title) > 200 ||
		len(req.TaxNumber) > 100 || len(req.Email) > 254 ||
		len(req.Phone) > 50 || len(req.Address) > 500 ||
		len(req.BankName) > 200 || len(req.BankAccount) > 100 ||
		(req.BuyerType != "individual" && req.BuyerType != "company") ||
		req.InvoiceType != "normal" {
		common.ApiErrorMsg(c, "Invalid invoice request")
		return
	}
	if req.Email != "" {
		if _, err := mail.ParseAddress(req.Email); err != nil {
			common.ApiErrorMsg(c, "Invalid email address")
			return
		}
	}
	if req.BuyerType == "company" && req.TaxNumber == "" {
		common.ApiErrorMsg(c, "Tax number is required for company invoices")
		return
	}
	normalizeInvoiceBuyerDetails(&req)
	invoice := &model.Invoice{InvoiceType: req.InvoiceType, BuyerType: req.BuyerType, Title: req.Title, TaxNumber: req.TaxNumber, Email: req.Email, Phone: req.Phone, Address: req.Address, BankName: req.BankName, BankAccount: req.BankAccount}
	if err := model.CreateInvoice(c.GetInt("id"), req.OrderIds, invoice); err != nil {
		if errors.Is(err, model.ErrInvoiceFrequencyLimited) {
			common.ApiErrorMsg(c, "Invoice request frequency limit reached")
			return
		}
		if errors.Is(err, model.ErrInvoiceOrderInvalid) {
			common.ApiErrorMsg(c, "One or more orders are not eligible for invoicing")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, invoice)
}

func GetAllInvoices(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	invoices, total, err := model.GetAllInvoices(pageInfo, c.Query("status"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(invoices)
	common.ApiSuccess(c, pageInfo)
}

func GetInvoiceSettings(c *gin.Context) {
	common.ApiSuccess(c, gin.H{"interval_days": model.InvoiceFrequencyDays(), "description": model.InvoiceRequestDescription()})
}

type updateInvoiceSettingsRequest struct {
	IntervalDays int     `json:"interval_days"`
	Description  *string `json:"description"`
}

func UpdateInvoiceSettings(c *gin.Context) {
	var req updateInvoiceSettingsRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || (req.IntervalDays != 0 && req.IntervalDays != 15 && req.IntervalDays != 30) {
		common.ApiErrorMsg(c, "Invoice request interval must be 0, 15, or 30 days")
		return
	}
	description := model.InvoiceRequestDescription()
	updates := map[string]string{"InvoiceRequestIntervalDays": strconv.Itoa(req.IntervalDays)}
	if req.Description != nil {
		description = strings.TrimSpace(*req.Description)
		if len(description) > 2000 {
			common.ApiErrorMsg(c, "Invoice notice is too long")
			return
		}
		updates["InvoiceRequestDescription"] = description
	}
	if err := model.UpdateOptionsBulk(updates); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "invoice.settings.update", map[string]interface{}{"interval_days": req.IntervalDays, "has_description": description != ""})
	common.ApiSuccess(c, gin.H{"interval_days": req.IntervalDays, "description": description})
}

func ProcessInvoice(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		common.ApiErrorMsg(c, "Invalid invoice ID")
		return
	}
	if err := model.UpdateInvoiceStatus(id, model.InvoiceStatusProcessing, "", "", ""); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "invoice.process", map[string]interface{}{"invoice_id": id})
	common.ApiSuccess(c, nil)
}

type issueInvoiceRequest struct {
	InvoiceNumber string `json:"invoice_number"`
	FileURL       string `json:"file_url"`
}

func IssueInvoice(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		common.ApiErrorMsg(c, "Invalid invoice ID")
		return
	}
	var req issueInvoiceRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request"})
		return
	}
	req.InvoiceNumber = strings.TrimSpace(req.InvoiceNumber)
	req.FileURL = strings.TrimSpace(req.FileURL)
	if req.InvoiceNumber == "" || len(req.InvoiceNumber) > 100 || req.FileURL == "" {
		common.ApiErrorMsg(c, "Invoice number and file URL are required")
		return
	}
	if err := validateInvoiceFileURL(req.FileURL); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	invoice, err := model.GetInvoiceByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	receiver := strings.TrimSpace(invoice.Email)
	if receiver == "" {
		receiver, err = model.GetUserEmail(invoice.UserId)
		if err != nil || strings.TrimSpace(receiver) == "" {
			common.ApiErrorMsg(c, "Invoice email is required")
			return
		}
	}
	if _, err := mail.ParseAddress(receiver); err != nil {
		common.ApiErrorMsg(c, "Invalid invoice email address")
		return
	}
	attachment, filename, err := downloadInvoiceAttachment(req.FileURL)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	content := fmt.Sprintf("<p>Your invoice request #%d has been issued.</p><p>Invoice number: %s</p><p>The invoice file is attached to this email.</p>", invoice.Id, html.EscapeString(req.InvoiceNumber))
	if err := common.SendEmailWithAttachment(fmt.Sprintf("%s - Invoice #%d", common.SystemName, invoice.Id), receiver, content, filename, attachment); err != nil {
		common.SysError(fmt.Sprintf("failed to email invoice %d to %s: %v", id, receiver, err))
		common.ApiErrorMsg(c, "Invoice email delivery failed; the invoice remains processing")
		return
	}
	if err := model.UpdateInvoiceStatus(id, model.InvoiceStatusIssued, "", req.InvoiceNumber, req.FileURL); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "invoice.issue", map[string]interface{}{
		"invoice_id":     id,
		"invoice_number": req.InvoiceNumber,
		"email":          receiver,
	})
	common.ApiSuccess(c, nil)
}

func RejectInvoice(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		common.ApiErrorMsg(c, "Invalid invoice ID")
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "Invalid request")
		return
	}
	reason := strings.TrimSpace(req.Reason)
	if reason == "" || len(reason) > 500 {
		common.ApiErrorMsg(c, "Rejection reason is required")
		return
	}
	if err := model.UpdateInvoiceStatus(id, model.InvoiceStatusRejected, reason, "", ""); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "invoice.reject", map[string]interface{}{
		"invoice_id": id,
		"reason":     reason,
	})
	common.ApiSuccess(c, nil)
}
