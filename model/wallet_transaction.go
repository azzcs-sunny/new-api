package model

import (
	"fmt"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
)

const walletTransactionQueryHardLimit = 10000

const (
	WalletTransactionSourceTopUp      = "online_topup"
	WalletTransactionSourceRedemption = "redemption"
	WalletTransactionSourceAdmin      = "admin_adjustment"
)

type WalletTransaction struct {
	Id             string   `json:"id"`
	Source         string   `json:"source"`
	Amount         int64    `json:"amount"`
	Money          *float64 `json:"money,omitempty"`
	TradeNo        string   `json:"trade_no,omitempty"`
	PaymentMethod  string   `json:"payment_method,omitempty"`
	Status         string   `json:"status"`
	CreateTime     int64    `json:"create_time"`
	CompleteTime   int64    `json:"complete_time,omitempty"`
	AdjustmentMode string   `json:"adjustment_mode,omitempty"`
	InvoiceIssued  bool     `json:"invoice_issued,omitempty"`
}

// GetWalletTransactions combines payment orders, redeemed codes, and
// administrator balance changes into one reverse-chronological wallet ledger.
func GetWalletTransactions(userId int, pageInfo *common.PageInfo) (transactions []*WalletTransaction, total int64, err error) {
	if pageInfo == nil || pageInfo.GetPage() < 1 || pageInfo.GetPageSize() < 1 {
		return nil, 0, fmt.Errorf("invalid pagination")
	}

	start := pageInfo.GetStartIdx()
	fetchLimit := pageInfo.GetEndIdx()
	if start >= walletTransactionQueryHardLimit {
		fetchLimit = 0
	} else if fetchLimit > walletTransactionQueryHardLimit {
		fetchLimit = walletTransactionQueryHardLimit
	}

	var topUpCount int64
	if err = DB.Model(&TopUp{}).Where("user_id = ? AND amount > ?", userId, 0).Count(&topUpCount).Error; err != nil {
		return nil, 0, err
	}
	var redemptionCount int64
	if err = DB.Unscoped().Model(&Redemption{}).
		Where("used_user_id = ? AND status = ?", userId, common.RedemptionCodeStatusUsed).
		Count(&redemptionCount).Error; err != nil {
		return nil, 0, err
	}
	var adjustmentCount int64
	if err = LOG_DB.Model(&Log{}).
		Where("user_id = ? AND type = ?", userId, LogTypeWalletAdjustment).
		Count(&adjustmentCount).Error; err != nil {
		return nil, 0, err
	}
	total = topUpCount + redemptionCount + adjustmentCount
	if fetchLimit == 0 {
		return []*WalletTransaction{}, total, nil
	}

	var topUps []*TopUp
	if err = DB.Where("user_id = ? AND amount > ?", userId, 0).
		Order("create_time desc, id desc").Limit(fetchLimit).Find(&topUps).Error; err != nil {
		return nil, 0, err
	}
	var redemptions []*Redemption
	if err = DB.Unscoped().Where("used_user_id = ? AND status = ?", userId, common.RedemptionCodeStatusUsed).
		Order("redeemed_time desc, id desc").Limit(fetchLimit).Find(&redemptions).Error; err != nil {
		return nil, 0, err
	}
	var adjustments []*Log
	adjustmentOrder := "created_at desc, id desc"
	if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		adjustmentOrder = clickHouseLogOrder("")
	}
	if err = LOG_DB.Where("user_id = ? AND type = ?", userId, LogTypeWalletAdjustment).
		Order(adjustmentOrder).Limit(fetchLimit).Find(&adjustments).Error; err != nil {
		return nil, 0, err
	}

	transactions = make([]*WalletTransaction, 0, len(topUps)+len(redemptions)+len(adjustments))
	quotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	for _, topUp := range topUps {
		money := topUp.Money
		amount := common.QuotaFromDecimal(decimal.NewFromInt(topUp.Amount).Mul(quotaPerUnit))
		if topUp.PaymentProvider == PaymentProviderStripe || topUp.PaymentMethod == PaymentMethodStripe {
			amount = common.QuotaFromDecimal(decimal.NewFromFloat(topUp.Money).Mul(quotaPerUnit))
		}
		if topUp.PaymentProvider == PaymentProviderCreem || topUp.PaymentMethod == PaymentMethodCreem {
			amount = common.QuotaFromDecimal(decimal.NewFromInt(topUp.Amount))
		}
		paymentMethod := topUp.PaymentMethod
		if paymentMethod == "" {
			paymentMethod = topUp.PaymentProvider
		}
		transactions = append(transactions, &WalletTransaction{
			Id:            fmt.Sprintf("topup-%d", topUp.Id),
			Source:        WalletTransactionSourceTopUp,
			Amount:        int64(amount),
			Money:         &money,
			TradeNo:       topUp.TradeNo,
			PaymentMethod: paymentMethod,
			Status:        topUp.Status,
			CreateTime:    topUp.CreateTime,
			CompleteTime:  topUp.CompleteTime,
			InvoiceIssued: topUp.InvoiceIssued,
		})
	}
	for _, redemption := range redemptions {
		transactions = append(transactions, &WalletTransaction{
			Id:            fmt.Sprintf("redemption-%d", redemption.Id),
			Source:        WalletTransactionSourceRedemption,
			Amount:        int64(redemption.Quota),
			TradeNo:       fmt.Sprintf("RED-%d", redemption.Id),
			PaymentMethod: WalletTransactionSourceRedemption,
			Status:        common.TopUpStatusSuccess,
			CreateTime:    redemption.RedeemedTime,
			CompleteTime:  redemption.RedeemedTime,
		})
	}
	for _, adjustment := range adjustments {
		adjustmentId := adjustment.RequestId
		if adjustmentId == "" {
			adjustmentId = fmt.Sprintf("%d", adjustment.Id)
		}
		meta := struct {
			WalletAdjustment struct {
				Mode string `json:"mode"`
			} `json:"wallet_adjustment"`
		}{}
		if adjustment.Other != "" {
			_ = common.UnmarshalJsonStr(adjustment.Other, &meta)
		}
		transactions = append(transactions, &WalletTransaction{
			Id:             "admin-" + adjustmentId,
			Source:         WalletTransactionSourceAdmin,
			Amount:         int64(adjustment.Quota),
			Status:         common.TopUpStatusSuccess,
			CreateTime:     adjustment.CreatedAt,
			CompleteTime:   adjustment.CreatedAt,
			AdjustmentMode: meta.WalletAdjustment.Mode,
		})
	}

	sort.Slice(transactions, func(i, j int) bool {
		if transactions[i].CreateTime == transactions[j].CreateTime {
			return transactions[i].Id > transactions[j].Id
		}
		return transactions[i].CreateTime > transactions[j].CreateTime
	})
	if start >= len(transactions) {
		return []*WalletTransaction{}, total, nil
	}
	end := start + pageInfo.GetPageSize()
	if end > len(transactions) {
		end = len(transactions)
	}
	return transactions[start:end], total, nil
}
