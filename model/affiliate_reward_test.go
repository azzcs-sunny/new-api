package model

import (
	"fmt"
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
