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
package model

import (
	"errors"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	InvoiceStatusPending    = "pending"
	InvoiceStatusProcessing = "processing"
	InvoiceStatusIssued     = "issued"
	InvoiceStatusRejected   = "rejected"
	InvoiceStatusCancelled  = "cancelled"
)

var (
	ErrInvoiceFrequencyLimited = errors.New("invoice request frequency limit reached")
	ErrInvoiceOrderInvalid     = errors.New("one or more orders are not eligible for invoicing")
	ErrInvoiceNotFound         = errors.New("invoice not found")
	ErrInvoiceStatusInvalid    = errors.New("invoice status transition is invalid")
)

type Invoice struct {
	Id            int            `json:"id"`
	UserId        int            `json:"user_id" gorm:"index"`
	InvoiceType   string         `json:"invoice_type" gorm:"type:varchar(20)"`
	BuyerType     string         `json:"buyer_type" gorm:"type:varchar(20)"`
	Title         string         `json:"title" gorm:"type:varchar(200)"`
	TaxNumber     string         `json:"tax_number" gorm:"type:varchar(100)"`
	Email         string         `json:"email" gorm:"type:varchar(254)"`
	Phone         string         `json:"phone" gorm:"type:varchar(50)"`
	Address       string         `json:"address" gorm:"type:varchar(500)"`
	BankName      string         `json:"bank_name" gorm:"type:varchar(200)"`
	BankAccount   string         `json:"bank_account" gorm:"type:varchar(100)"`
	Amount        float64        `json:"amount" gorm:"not null"`
	Status        string         `json:"status" gorm:"index;type:varchar(20)"`
	RejectReason  string         `json:"reject_reason" gorm:"type:varchar(500)"`
	InvoiceNumber string         `json:"invoice_number" gorm:"type:varchar(100)"`
	FileURL       string         `json:"file_url" gorm:"type:text"`
	CreateTime    int64          `json:"create_time"`
	UpdatedTime   int64          `json:"updated_time"`
	IssueTime     int64          `json:"issue_time"`
	Orders        []InvoiceOrder `json:"orders,omitempty" gorm:"foreignKey:InvoiceId"`
}

type InvoiceOrder struct {
	Id        int   `json:"id"`
	InvoiceId int   `json:"invoice_id" gorm:"index;uniqueIndex:idx_invoice_order"`
	TopUpId   int   `json:"topup_id" gorm:"index;uniqueIndex:idx_invoice_order"`
	TopUp     TopUp `json:"topup" gorm:"foreignKey:TopUpId"`
}

type InvoiceOrderItem struct {
	TopUpId    int     `json:"topup_id"`
	TradeNo    string  `json:"trade_no"`
	Amount     int64   `json:"amount"`
	Money      float64 `json:"money"`
	CreateTime int64   `json:"create_time"`
}

func InvoiceFrequencyDays() int {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if value, ok := common.OptionMap["InvoiceRequestIntervalDays"]; ok {
		days, err := strconv.Atoi(value)
		if err == nil && (days == 0 || days == 15 || days == 30) {
			return days
		}
	}
	return 0
}

func InvoiceRequestDescription() string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return strings.TrimSpace(common.OptionMap["InvoiceRequestDescription"])
}

func GetInvoiceRequestAvailability(userId int) (bool, int64, error) {
	interval := InvoiceFrequencyDays()
	if interval == 0 {
		return true, 0, nil
	}
	var latest Invoice
	err := DB.Where("user_id = ? AND status IN ?", userId, []string{InvoiceStatusPending, InvoiceStatusProcessing, InvoiceStatusIssued}).Order("create_time desc").First(&latest).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return true, 0, nil
	}
	if err != nil {
		return false, 0, err
	}
	nextAvailableAt := latest.CreateTime + int64(interval*86400)
	return time.Now().Unix() >= nextAvailableAt, nextAvailableAt, nil
}

func GetEligibleInvoiceOrders(userId int) ([]InvoiceOrderItem, error) {
	var items []InvoiceOrderItem
	return items, eligibleInvoiceOrdersQuery(userId).Order("top_ups.id desc").Find(&items).Error
}

func GetEligibleInvoiceOrdersPaged(userId int, pageInfo *common.PageInfo) ([]InvoiceOrderItem, int64, error) {
	var items []InvoiceOrderItem
	var total int64
	query := eligibleInvoiceOrdersQuery(userId)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("top_ups.id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&items).Error
	return items, total, err
}

func eligibleInvoiceOrdersQuery(userId int) *gorm.DB {
	return DB.Model(&TopUp{}).
		Select("top_ups.id as top_up_id, top_ups.trade_no, top_ups.amount, top_ups.money, top_ups.create_time").
		Where("top_ups.user_id = ? AND top_ups.status = ?", userId, common.TopUpStatusSuccess).
		Where("((top_ups.payment_provider <> ? AND top_ups.payment_method <> ?) OR top_ups.invoice_available = ? OR top_ups.invoice_available IS NULL)", PaymentProviderRedemption, PaymentMethodRedemption, true).
		Where("top_ups.money > ?", 0).
		Where("(top_ups.invoice_issued = ? OR top_ups.invoice_issued IS NULL)", false).
		Where("NOT EXISTS (?)", DB.Model(&InvoiceOrder{}).Select("1").Where("invoice_orders.top_up_id = top_ups.id").Joins("JOIN invoices ON invoices.id = invoice_orders.invoice_id").Where("invoices.status IN ?", []string{InvoiceStatusPending, InvoiceStatusProcessing, InvoiceStatusIssued}))
}

func GetUserInvoices(userId int, pageInfo *common.PageInfo) ([]*Invoice, int64, error) {
	var invoices []*Invoice
	var total int64
	query := DB.Model(&Invoice{}).Where("user_id = ?", userId)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Preload("Orders.TopUp").Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&invoices).Error
	return invoices, total, err
}

func GetAllInvoices(pageInfo *common.PageInfo, status string) ([]*Invoice, int64, error) {
	var invoices []*Invoice
	var total int64
	query := DB.Model(&Invoice{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Preload("Orders.TopUp").Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&invoices).Error
	return invoices, total, err
}

func GetInvoiceByID(id int) (*Invoice, error) {
	var invoice Invoice
	if err := DB.Where("id = ?", id).First(&invoice).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvoiceNotFound
		}
		return nil, err
	}
	return &invoice, nil
}

func CreateInvoice(userId int, orderIds []int, invoice *Invoice) error {
	if len(orderIds) == 0 || len(orderIds) > 100 {
		return ErrInvoiceOrderInvalid
	}
	seen := make(map[int]struct{}, len(orderIds))
	for _, orderId := range orderIds {
		if orderId <= 0 {
			return ErrInvoiceOrderInvalid
		}
		if _, exists := seen[orderId]; exists {
			return ErrInvoiceOrderInvalid
		}
		seen[orderId] = struct{}{}
	}
	sortedOrderIds := append([]int(nil), orderIds...)
	sort.Ints(sortedOrderIds)
	return DB.Transaction(func(tx *gorm.DB) error {
		// Payment completion also locks TopUp before User. Keep the same order
		// here so a payment callback cannot deadlock with an invoice request.
		orders := make([]TopUp, 0, len(sortedOrderIds))
		for _, orderId := range sortedOrderIds {
			var order TopUp
			if err := lockForUpdate(tx).
				Where("user_id = ? AND id = ? AND status = ?", userId, orderId, common.TopUpStatusSuccess).
				First(&order).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrInvoiceOrderInvalid
				}
				return err
			}
			orders = append(orders, order)
		}

		var user User
		if err := lockForUpdate(tx).Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		interval := InvoiceFrequencyDays()
		if interval > 0 {
			var latest Invoice
			err := tx.Where("user_id = ? AND status IN ?", userId, []string{InvoiceStatusPending, InvoiceStatusProcessing, InvoiceStatusIssued}).Order("create_time desc").First(&latest).Error
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			if err == nil && latest.CreateTime > time.Now().Unix()-int64(interval*86400) {
				return ErrInvoiceFrequencyLimited
			}
		}
		amount := decimal.Zero
		for _, order := range orders {
			if order.InvoiceIssued {
				return ErrInvoiceOrderInvalid
			}
			var count int64
			if err := tx.Model(&InvoiceOrder{}).Joins("JOIN invoices ON invoices.id = invoice_orders.invoice_id").Where("invoice_orders.top_up_id = ? AND invoices.status IN ?", order.Id, []string{InvoiceStatusPending, InvoiceStatusProcessing, InvoiceStatusIssued}).Count(&count).Error; err != nil {
				return err
			}
			if count > 0 {
				return ErrInvoiceOrderInvalid
			}
			amount = amount.Add(decimal.NewFromFloat(order.Money))
		}
		invoice.Amount, _ = amount.Round(2).Float64()
		invoice.UserId = userId
		invoice.Status = InvoiceStatusPending
		invoice.CreateTime = time.Now().Unix()
		invoice.UpdatedTime = invoice.CreateTime
		if err := tx.Create(invoice).Error; err != nil {
			return err
		}
		for _, order := range orders {
			if err := tx.Create(&InvoiceOrder{InvoiceId: invoice.Id, TopUpId: order.Id}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func UpdateInvoiceStatus(id int, targetStatus, reason, number, fileURL string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var invoice Invoice
		if err := lockForUpdate(tx).Where("id = ?", id).First(&invoice).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrInvoiceNotFound
			}
			return err
		}
		validTransition := targetStatus == InvoiceStatusProcessing && invoice.Status == InvoiceStatusPending ||
			targetStatus == InvoiceStatusIssued && invoice.Status == InvoiceStatusProcessing ||
			targetStatus == InvoiceStatusRejected && (invoice.Status == InvoiceStatusPending || invoice.Status == InvoiceStatusProcessing)
		if !validTransition {
			return ErrInvoiceStatusInvalid
		}
		updates := map[string]interface{}{
			"status":        targetStatus,
			"updated_time":  time.Now().Unix(),
			"reject_reason": reason,
		}
		if targetStatus == InvoiceStatusIssued {
			updates["invoice_number"] = number
			updates["file_url"] = fileURL
			updates["issue_time"] = time.Now().Unix()
		}
		if err := tx.Model(&invoice).Updates(updates).Error; err != nil {
			return err
		}
		if targetStatus == InvoiceStatusIssued {
			var orders []InvoiceOrder
			if err := tx.Where("invoice_id = ?", invoice.Id).Find(&orders).Error; err != nil {
				return err
			}
			if len(orders) > 0 {
				topUpIDs := make([]int, 0, len(orders))
				for _, order := range orders {
					topUpIDs = append(topUpIDs, order.TopUpId)
				}
				if err := tx.Model(&TopUp{}).Where("id IN ?", topUpIDs).Update("invoice_issued", true).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}
