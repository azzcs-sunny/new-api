package model

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

type Redemption struct {
	Id             int            `json:"id"`
	UserId         int            `json:"user_id"`
	Key            string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status         int            `json:"status" gorm:"default:1"`
	Name           string         `json:"name" gorm:"index"`
	Quota          int            `json:"quota" gorm:"default:100"`
	InvoiceEnabled bool           `json:"invoice_enabled"`
	InvoiceAmount  float64        `json:"invoice_amount"`
	CreatedTime    int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime   int64          `json:"redeemed_time" gorm:"bigint"`
	Count          int            `json:"count" gorm:"-:all"` // only for api request
	UsedUserId     int            `json:"used_user_id"`
	DeletedAt      gorm.DeletedAt `gorm:"index"`
	ExpiredTime    int64          `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期
}

type RedemptionInvoiceBatchResult struct {
	Updated         int `json:"updated"`
	CreatedOrders   int `json:"created_orders"`
	UpdatedOrders   int `json:"updated_orders"`
	SkippedInvoiced int `json:"skipped_invoiced"`
	SkippedInvalid  int `json:"skipped_invalid"`
}

func GetAllRedemptions(startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	// 开始事务
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 获取总数
	err = tx.Model(&Redemption{}).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 获取分页数据
	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 提交事务
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func SearchRedemptions(keyword string, status string, startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&Redemption{})

	if keyword != "" {
		if id, err := strconv.Atoi(keyword); err == nil {
			query = query.Where("id = ? OR name LIKE ?", id, keyword+"%")
		} else {
			query = query.Where("name LIKE ?", keyword+"%")
		}
	}

	if status != "" {
		now := common.GetTimestamp()
		switch status {
		case "expired":
			query = query.Where(
				"status = ? AND expired_time != 0 AND expired_time < ?",
				common.RedemptionCodeStatusEnabled,
				now,
			)
		case strconv.Itoa(common.RedemptionCodeStatusEnabled):
			query = query.Where(
				"status = ? AND (expired_time = 0 OR expired_time >= ?)",
				common.RedemptionCodeStatusEnabled,
				now,
			)
		case strconv.Itoa(common.RedemptionCodeStatusDisabled):
			query = query.Where("status = ?", common.RedemptionCodeStatusDisabled)
		case strconv.Itoa(common.RedemptionCodeStatusUsed):
			query = query.Where("status = ?", common.RedemptionCodeStatusUsed)
		}
	}

	// Get total count
	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// Get paginated data
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func GetRedemptionById(id int) (*Redemption, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	var err error = nil
	err = DB.First(&redemption, "id = ?", id).Error
	return &redemption, err
}

func normalizeRedemptionInvoiceFields(redemption *Redemption) error {
	if !redemption.InvoiceEnabled {
		redemption.InvoiceAmount = 0
		return nil
	}
	if redemption.InvoiceAmount <= 0 || math.IsNaN(redemption.InvoiceAmount) || math.IsInf(redemption.InvoiceAmount, 0) {
		return errors.New("invalid invoice amount")
	}
	return nil
}

func redemptionTopUpTradeNo(redemptionId int) string {
	return fmt.Sprintf("RED-%d", redemptionId)
}

func createRedemptionTopUp(tx *gorm.DB, redemption *Redemption) error {
	if redemption.Status != common.RedemptionCodeStatusUsed || redemption.UsedUserId == 0 || redemption.RedeemedTime == 0 {
		return errors.New("redemption is not used")
	}
	redemptionId := redemption.Id
	topUp := TopUp{
		UserId:           redemption.UsedUserId,
		Amount:           int64(redemption.Quota),
		Money:            redemption.InvoiceAmount,
		TradeNo:          redemptionTopUpTradeNo(redemption.Id),
		PaymentMethod:    PaymentMethodRedemption,
		PaymentProvider:  PaymentProviderRedemption,
		CreateTime:       redemption.RedeemedTime,
		CompleteTime:     redemption.RedeemedTime,
		Status:           common.TopUpStatusSuccess,
		InvoiceAvailable: redemption.InvoiceEnabled,
		RedemptionId:     &redemptionId,
	}
	return tx.Create(&topUp).Error
}

func topUpHasActiveInvoice(tx *gorm.DB, topUpId int) (bool, error) {
	var count int64
	err := tx.Model(&InvoiceOrder{}).
		Joins("JOIN invoices ON invoices.id = invoice_orders.invoice_id").
		Where("invoice_orders.top_up_id = ? AND invoices.status IN ?", topUpId, []string{InvoiceStatusPending, InvoiceStatusProcessing, InvoiceStatusIssued}).
		Count(&count).Error
	return count > 0, err
}

func Redeem(key string, userId int) (quota int, err error) {
	if key == "" {
		return 0, errors.New("未提供兑换码")
	}
	if userId == 0 {
		return 0, errors.New("无效的 user id")
	}
	redemption := &Redemption{}

	keyCol := "`key`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		keyCol = `"key"`
	}
	common.RandomSleep()
	err = DB.Transaction(func(tx *gorm.DB) error {
		err := lockForUpdate(tx).Where(keyCol+" = ?", key).First(redemption).Error
		if err != nil {
			return errors.New("无效的兑换码")
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return errors.New("该兑换码已被使用")
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return errors.New("该兑换码已过期")
		}
		// Compare-and-swap on status: only the transaction that flips
		// enabled -> used may credit quota, so a concurrent redeem of the
		// same code loses here even without a row lock (e.g. on SQLite).
		redeemedTime := common.GetTimestamp()
		result := tx.Model(&Redemption{}).
			Where("id = ? AND status = ?", redemption.Id, common.RedemptionCodeStatusEnabled).
			Updates(map[string]any{
				"redeemed_time": redeemedTime,
				"status":        common.RedemptionCodeStatusUsed,
				"used_user_id":  userId,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("该兑换码已被使用")
		}
		redemption.RedeemedTime = redeemedTime
		redemption.Status = common.RedemptionCodeStatusUsed
		redemption.UsedUserId = userId
		if err := normalizeRedemptionInvoiceFields(redemption); err != nil {
			return err
		}
		if err := createRedemptionTopUp(tx, redemption); err != nil {
			return err
		}
		return creditTopUpQuota(tx, userId, redemption.Quota, nil)
	})
	if err != nil {
		common.SysError("redemption failed: " + err.Error())
		return 0, ErrRedeemFailed
	}
	syncCreditUserQuotaCache(userId, redemption.Quota, "redemption")
	RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码充值 %s，兑换码ID %d", logger.LogQuota(redemption.Quota), redemption.Id))
	return redemption.Quota, nil
}

func (redemption *Redemption) Insert() error {
	if redemption.Quota <= 0 {
		return errors.New("redemption quota must be positive")
	}
	if err := common.ValidateWalletQuota(redemption.Quota); err != nil {
		return err
	}
	var err error
	err = DB.Create(redemption).Error
	return err
}

func (redemption *Redemption) SelectUpdate() error {
	// This can update zero values
	return DB.Model(redemption).Select("redeemed_time", "status").Updates(redemption).Error
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (redemption *Redemption) Update() error {
	if redemption.Quota <= 0 {
		return errors.New("redemption quota must be positive")
	}
	if err := common.ValidateWalletQuota(redemption.Quota); err != nil {
		return err
	}
	if err := normalizeRedemptionInvoiceFields(redemption); err != nil {
		return err
	}
	var err error
	err = DB.Model(redemption).Select("name", "status", "quota", "redeemed_time", "expired_time", "invoice_enabled", "invoice_amount").Updates(redemption).Error
	return err
}

func UpdateRedemptionInvoiceSettings(ids []int, invoiceEnabled bool, invoiceAmount float64) (*RedemptionInvoiceBatchResult, error) {
	if len(ids) == 0 || len(ids) > 1000 {
		return nil, errors.New("invalid redemption ids")
	}
	prototype := &Redemption{InvoiceEnabled: invoiceEnabled, InvoiceAmount: invoiceAmount}
	if err := normalizeRedemptionInvoiceFields(prototype); err != nil {
		return nil, err
	}
	seen := make(map[int]struct{}, len(ids))
	sortedIds := make([]int, 0, len(ids))
	for _, id := range ids {
		if id <= 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		sortedIds = append(sortedIds, id)
	}
	if len(sortedIds) == 0 {
		return nil, errors.New("invalid redemption ids")
	}
	sort.Ints(sortedIds)

	result := &RedemptionInvoiceBatchResult{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		for _, id := range sortedIds {
			var redemption Redemption
			if err := lockForUpdate(tx).Where("id = ?", id).First(&redemption).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					result.SkippedInvalid++
					continue
				}
				return err
			}

			var topUp TopUp
			topUpErr := lockForUpdate(tx).Where("redemption_id = ?", redemption.Id).First(&topUp).Error
			if topUpErr != nil && !errors.Is(topUpErr, gorm.ErrRecordNotFound) {
				return topUpErr
			}
			hasTopUp := topUpErr == nil
			if hasTopUp {
				hasActiveInvoice, err := topUpHasActiveInvoice(tx, topUp.Id)
				if err != nil {
					return err
				}
				if topUp.InvoiceIssued || hasActiveInvoice {
					result.SkippedInvoiced++
					continue
				}
			}

			redemption.InvoiceEnabled = prototype.InvoiceEnabled
			redemption.InvoiceAmount = prototype.InvoiceAmount
			if err := tx.Model(&redemption).Select("invoice_enabled", "invoice_amount").Updates(&redemption).Error; err != nil {
				return err
			}
			result.Updated++

			if redemption.Status != common.RedemptionCodeStatusUsed {
				continue
			}
			if hasTopUp {
				if err := tx.Model(&topUp).Updates(map[string]interface{}{
					"money":             redemption.InvoiceAmount,
					"invoice_available": redemption.InvoiceEnabled,
				}).Error; err != nil {
					return err
				}
				result.UpdatedOrders++
				continue
			}
			if err := createRedemptionTopUp(tx, &redemption); err != nil {
				return err
			}
			result.CreatedOrders++
		}
		return nil
	})
	return result, err
}

func (redemption *Redemption) Delete() error {
	var err error
	err = DB.Delete(redemption).Error
	return err
}

func DeleteRedemptionById(id int) (err error) {
	if id == 0 {
		return errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	err = DB.Where(redemption).First(&redemption).Error
	if err != nil {
		return err
	}
	return redemption.Delete()
}

func DeleteInvalidRedemptions() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Where("status IN ? OR (status = ? AND expired_time != 0 AND expired_time < ?)", []int{common.RedemptionCodeStatusUsed, common.RedemptionCodeStatusDisabled}, common.RedemptionCodeStatusEnabled, now).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}

// BatchDeleteRedemptions soft-deletes the selected codes in one statement.
func BatchDeleteRedemptions(ids []int) (int64, error) {
	if len(ids) == 0 || len(ids) > 1000 {
		return 0, errors.New("select between 1 and 1000 redemption codes")
	}
	for _, id := range ids {
		if id <= 0 {
			return 0, errors.New("redemption IDs must be positive")
		}
	}
	result := DB.Where("id IN ?", ids).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}
