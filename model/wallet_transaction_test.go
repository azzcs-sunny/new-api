package model

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetWalletTransactionsCombinesWalletCreditSources(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	t.Cleanup(func() { DB.Exec("DELETE FROM redemptions") })

	const userId = 901
	require.NoError(t, DB.Create(&User{Id: userId, Username: "wallet-ledger-user"}).Error)
	require.NoError(t, DB.Create(&TopUp{
		UserId: userId, Amount: 1000, Money: 10, TradeNo: "wallet-ledger-topup",
		PaymentMethod: PaymentMethodStripe, Status: common.TopUpStatusSuccess,
		CreateTime: 100, CompleteTime: 101,
	}).Error)
	redemption := &Redemption{
		UserId: 12, UsedUserId: userId, Name: "wallet-ledger-code", Key: "wallet-ledger-redemption-key",
		Quota: 2000, Status: common.RedemptionCodeStatusUsed, CreatedTime: 110, RedeemedTime: 200,
	}
	require.NoError(t, DB.Create(redemption).Error)
	require.NoError(t, LOG_DB.Create(&Log{
		UserId: userId, Type: LogTypeWalletAdjustment, Quota: -300, CreatedAt: 300,
		Other: common.MapToJsonStr(map[string]interface{}{
			"wallet_adjustment": map[string]interface{}{"mode": "subtract"},
		}),
	}).Error)
	require.NoError(t, DB.Create(&AffiliateReward{
		TopUpId: 99901, InviteeId: 903, InviterId: userId, RewardQuota: 450,
		Status: AffiliateRewardGranted, CreatedAt: 250,
	}).Error)
	require.NoError(t, DB.Create(&TopUp{
		UserId: 902, Amount: 9999, TradeNo: "another-users-topup",
		Status: common.TopUpStatusSuccess, CreateTime: 400,
	}).Error)
	require.NoError(t, DB.Create(&TopUp{
		UserId: userId, Amount: 5000, Money: 50, TradeNo: "wallet-ledger-pending-topup",
		PaymentMethod: PaymentMethodStripe, Status: common.TopUpStatusPending,
		CreateTime: 500,
	}).Error)
	require.NoError(t, DB.Create(&TopUp{
		UserId: userId, Amount: 6000, Money: 60, TradeNo: "wallet-ledger-failed-topup",
		PaymentMethod: PaymentMethodStripe, Status: common.TopUpStatusFailed,
		CreateTime: 600,
	}).Error)

	firstPage, total, err := GetWalletTransactions(userId, &common.PageInfo{Page: 1, PageSize: 2})
	require.NoError(t, err)
	assert.EqualValues(t, 4, total)
	require.Len(t, firstPage, 2)
	assert.Equal(t, WalletTransactionSourceAdmin, firstPage[0].Source)
	assert.EqualValues(t, -300, firstPage[0].Amount)
	assert.Equal(t, "subtract", firstPage[0].AdjustmentMode)
	assert.Equal(t, WalletTransactionSourceAffiliate, firstPage[1].Source)
	assert.EqualValues(t, 450, firstPage[1].Amount)
	assert.Empty(t, firstPage[1].TradeNo)

	secondPage, total, err := GetWalletTransactions(userId, &common.PageInfo{Page: 2, PageSize: 2})
	require.NoError(t, err)
	assert.EqualValues(t, 4, total)
	require.Len(t, secondPage, 2)
	assert.Equal(t, WalletTransactionSourceRedemption, secondPage[0].Source)
	assert.EqualValues(t, 2000, secondPage[0].Amount)
	assert.Equal(t, "RED-"+strconv.Itoa(redemption.Id), secondPage[0].TradeNo)
	assert.Equal(t, WalletTransactionSourceTopUp, secondPage[1].Source)
	assert.Equal(t, "wallet-ledger-topup", secondPage[1].TradeNo)
	assert.Equal(t, PaymentMethodStripe, secondPage[1].PaymentMethod)
	assert.EqualValues(t, common.QuotaFromFloat(10*common.QuotaPerUnit), secondPage[1].Amount)
	assert.Equal(t, common.TopUpStatusSuccess, secondPage[1].Status)
}
