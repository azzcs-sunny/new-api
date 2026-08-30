package model

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRechargeEpayCreditsReferralRewardForFirstThreeTopUps(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	oldRewardRatio := common.AffiliateRewardRatio
	oldCompliance := operation_setting.GetPaymentSetting().ComplianceConfirmed
	oldTermsVersion := operation_setting.GetPaymentSetting().ComplianceTermsVersion
	common.QuotaPerUnit = 1
	common.AffiliateRewardRatio = 0.1
	operation_setting.GetPaymentSetting().ComplianceConfirmed = true
	operation_setting.GetPaymentSetting().ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	t.Cleanup(func() {
		common.QuotaPerUnit = oldQuotaPerUnit
		common.AffiliateRewardRatio = oldRewardRatio
		operation_setting.GetPaymentSetting().ComplianceConfirmed = oldCompliance
		operation_setting.GetPaymentSetting().ComplianceTermsVersion = oldTermsVersion
	})

	inviter := &User{Username: "reward-inviter", AffCode: "reward-code", Status: common.UserStatusEnabled}
	invitee := &User{Username: "reward-invitee", InviterId: 0, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(inviter).Error)
	invitee.InviterId = inviter.Id
	require.NoError(t, DB.Create(invitee).Error)

	for i := 1; i <= 4; i++ {
		order := &TopUp{
			UserId:          invitee.Id,
			Amount:          100,
			TradeNo:         fmt.Sprintf("reward-order-%d", i),
			PaymentProvider: PaymentProviderEpay,
			PaymentMethod:   "alipay",
			Status:          common.TopUpStatusPending,
		}
		require.NoError(t, order.Insert())
		_, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
		require.NoError(t, err)
	}

	var rewards []AffiliateReward
	require.NoError(t, DB.Order("sequence").Find(&rewards).Error)
	require.Len(t, rewards, 3)
	assert.Equal(t, []int{1, 2, 3}, []int{rewards[0].Sequence, rewards[1].Sequence, rewards[2].Sequence})
	assert.Equal(t, 30, rewards[0].RewardQuota+rewards[1].RewardQuota+rewards[2].RewardQuota)

	var got User
	require.NoError(t, DB.First(&got, inviter.Id).Error)
	assert.Equal(t, 0, got.AffQuota)
	assert.Equal(t, 0, got.AffHistoryQuota)

	// Frozen rewards become available after the 24-hour holding period.
	require.NoError(t, DB.Model(&AffiliateReward{}).Where("status = ?", AffiliateRewardFrozen).Update("created_at", common.GetTimestamp()-AffiliateRewardFreezeSeconds-1).Error)
	require.NoError(t, ReleaseAffiliateRewards(inviter.Id))
	require.NoError(t, DB.First(&got, inviter.Id).Error)
	assert.Equal(t, 30, got.AffQuota)
	assert.Equal(t, 30, got.AffHistoryQuota)

	_, err := RechargeEpay("reward-order-1", "alipay", "127.0.0.1")
	require.NoError(t, err)
	var rewardCount int64
	require.NoError(t, DB.Model(&AffiliateReward{}).Where("top_up_id = ?", rewards[0].TopUpId).Count(&rewardCount).Error)
	assert.Equal(t, int64(1), rewardCount)
}

func TestAffiliateRewardDetailsRespectPrivacyAndOwnership(t *testing.T) {
	truncateTables(t)

	inviter := &User{Username: "detail-inviter", AffCode: "detail-code-one", Status: common.UserStatusEnabled}
	otherInviter := &User{Username: "detail-other-inviter", AffCode: "detail-code-two", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(inviter).Error)
	require.NoError(t, DB.Create(otherInviter).Error)
	invitee := &User{Username: "detail-invitee", InviterId: inviter.Id, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(invitee).Error)
	topUp := &TopUp{
		UserId: invitee.Id, Amount: 500, Money: 12.5, TradeNo: "private-order-number",
		PaymentProvider: PaymentProviderStripe, Status: common.TopUpStatusSuccess,
	}
	require.NoError(t, DB.Create(topUp).Error)
	require.NoError(t, DB.Create(&AffiliateReward{
		TopUpId: topUp.Id, InviteeId: invitee.Id, InviterId: inviter.Id, Sequence: 1,
		BaseQuota: 500, RewardQuota: 50, Ratio: 0.1, Status: AffiliateRewardFrozen,
	}).Error)
	secondTopUp := &TopUp{
		UserId: invitee.Id, Amount: 800, Money: 20, TradeNo: "second-private-order-number",
		PaymentProvider: PaymentProviderStripe, Status: common.TopUpStatusSuccess,
	}
	require.NoError(t, DB.Create(secondTopUp).Error)
	require.NoError(t, DB.Create(&AffiliateReward{
		TopUpId: secondTopUp.Id, InviteeId: invitee.Id, InviterId: inviter.Id, Sequence: 2,
		BaseQuota: 800, RewardQuota: 80, Ratio: 0.1, Status: AffiliateRewardFrozen,
	}).Error)

	firstPage := &common.PageInfo{Page: 1, PageSize: 1}
	userDetails, total, err := GetAffiliateRewardDetails(inviter.Id, invitee.Id, firstPage)
	require.NoError(t, err)
	require.Len(t, userDetails, 1)
	assert.Equal(t, int64(2), total)
	assert.Equal(t, 1, userDetails[0].Sequence)
	assert.Equal(t, 50, userDetails[0].RewardQuota)
	encoded, err := common.Marshal(userDetails)
	require.NoError(t, err)
	userJSON := string(encoded)
	assert.False(t, strings.Contains(userJSON, "top_up_id"))
	assert.False(t, strings.Contains(userJSON, "trade_no"))
	assert.False(t, strings.Contains(userJSON, "base_quota"))
	assert.False(t, strings.Contains(userJSON, topUp.TradeNo))

	secondPageDetails, total, err := GetAffiliateRewardDetails(inviter.Id, invitee.Id, &common.PageInfo{Page: 2, PageSize: 1})
	require.NoError(t, err)
	require.Len(t, secondPageDetails, 1)
	assert.Equal(t, int64(2), total)
	assert.Equal(t, 2, secondPageDetails[0].Sequence)
	assert.Equal(t, 80, secondPageDetails[0].RewardQuota)

	otherDetails, total, err := GetAffiliateRewardDetails(otherInviter.Id, invitee.Id, firstPage)
	require.NoError(t, err)
	assert.Empty(t, otherDetails)
	assert.Zero(t, total)

	adminDetails, total, err := GetAffiliateRewardAdminDetails(inviter.Id, invitee.Id, firstPage)
	require.NoError(t, err)
	require.Len(t, adminDetails, 1)
	assert.Equal(t, int64(2), total)
	assert.Equal(t, topUp.Id, adminDetails[0].TopUpId)
	assert.Equal(t, topUp.TradeNo, adminDetails[0].TradeNo)
	assert.Equal(t, 500, adminDetails[0].BaseQuota)
}
