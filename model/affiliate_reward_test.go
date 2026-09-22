package model

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRechargeEpayCreditsReferralRewardForEveryTopUpWithUserRatio(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	oldRewardRatio := common.AffiliateRewardRatio
	oldCompliance := operation_setting.GetPaymentSetting().ComplianceConfirmed
	oldTermsVersion := operation_setting.GetPaymentSetting().ComplianceTermsVersion
	common.QuotaPerUnit = 1
	common.AffiliateRewardRatio = 0.03
	operation_setting.GetPaymentSetting().ComplianceConfirmed = true
	operation_setting.GetPaymentSetting().ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	t.Cleanup(func() {
		common.QuotaPerUnit = oldQuotaPerUnit
		common.AffiliateRewardRatio = oldRewardRatio
		operation_setting.GetPaymentSetting().ComplianceConfirmed = oldCompliance
		operation_setting.GetPaymentSetting().ComplianceTermsVersion = oldTermsVersion
	})

	userRatio := 0.2
	inviter := &User{Username: "reward-inviter", AffCode: "reward-code", Status: common.UserStatusEnabled, AffiliateRewardRatio: &userRatio}
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
	require.NoError(t, DB.Model(inviter).Update("affiliate_reward_ratio", nil).Error)
	fallbackOrder := &TopUp{
		UserId: invitee.Id, Amount: 100, TradeNo: "reward-order-5",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", Status: common.TopUpStatusPending,
	}
	require.NoError(t, fallbackOrder.Insert())
	_, err := RechargeEpay(fallbackOrder.TradeNo, "alipay", "127.0.0.1")
	require.NoError(t, err)

	var rewards []AffiliateReward
	require.NoError(t, DB.Order("sequence").Find(&rewards).Error)
	require.Len(t, rewards, 5)
	assert.Equal(t, []int{1, 2, 3, 4, 5}, []int{rewards[0].Sequence, rewards[1].Sequence, rewards[2].Sequence, rewards[3].Sequence, rewards[4].Sequence})
	assert.Equal(t, 83, rewards[0].RewardQuota+rewards[1].RewardQuota+rewards[2].RewardQuota+rewards[3].RewardQuota+rewards[4].RewardQuota)
	assert.Equal(t, 0.2, rewards[0].Ratio)
	assert.Equal(t, 0.03, rewards[4].Ratio)

	var got User
	require.NoError(t, DB.First(&got, inviter.Id).Error)
	assert.Equal(t, 0, got.AffQuota)
	assert.Equal(t, 83, got.AffHistoryQuota)
	assert.Equal(t, 83, got.Quota)
	for _, reward := range rewards {
		assert.Equal(t, AffiliateRewardGranted, reward.Status)
	}
	invoiceOrders, err := GetEligibleInvoiceOrders(inviter.Id)
	require.NoError(t, err)
	assert.Empty(t, invoiceOrders)

	_, err = RechargeEpay("reward-order-1", "alipay", "127.0.0.1")
	require.NoError(t, err)
	var rewardCount int64
	require.NoError(t, DB.Model(&AffiliateReward{}).Where("top_up_id = ?", rewards[0].TopUpId).Count(&rewardCount).Error)
	assert.Equal(t, int64(1), rewardCount)
}

func TestAffiliateRewardExcludesRedemptionTopUps(t *testing.T) {
	truncateTables(t)

	inviter := &User{Username: "redemption-inviter", AffCode: "redemption-inviter-code", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(inviter).Error)
	invitee := &User{Username: "redemption-invitee", AffCode: "redemption-invitee-code", InviterId: inviter.Id, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(invitee).Error)
	topUp := &TopUp{
		UserId: invitee.Id, Amount: 100, TradeNo: "redemption-referral-order",
		PaymentMethod: PaymentMethodRedemption, PaymentProvider: PaymentProviderRedemption,
		Status: common.TopUpStatusSuccess,
	}
	require.NoError(t, DB.Create(topUp).Error)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return applyAffiliateTopUpRewardTx(tx, topUp, 100, nil)
	}))

	var count int64
	require.NoError(t, DB.Model(&AffiliateReward{}).Count(&count).Error)
	assert.Zero(t, count)
	require.NoError(t, DB.First(inviter, inviter.Id).Error)
	assert.Zero(t, inviter.Quota)
	assert.Zero(t, inviter.AffHistoryQuota)
}

func TestMigrateAffiliateRewardsToBalanceIsIdempotent(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	require.NoError(t, DB.Where("key = ?", affiliateDirectBalanceMigrationKey).Delete(&Option{}).Error)
	t.Cleanup(func() {
		DB.Where("key = ?", affiliateDirectBalanceMigrationKey).Delete(&Option{})
	})

	inviter := &User{Username: "migration-inviter", AffCode: "migration-inviter-code", Quota: 100, AffQuota: 40, AffHistoryQuota: 40}
	invitee := &User{Username: "migration-invitee", AffCode: "migration-invitee-code"}
	require.NoError(t, DB.Create(inviter).Error)
	invitee.InviterId = inviter.Id
	require.NoError(t, DB.Create(invitee).Error)
	topUp := &TopUp{UserId: invitee.Id, Amount: 100, TradeNo: "migration-reward-order", Status: common.TopUpStatusSuccess}
	require.NoError(t, DB.Create(topUp).Error)
	require.NoError(t, DB.Create(&AffiliateReward{
		TopUpId: topUp.Id, InviteeId: invitee.Id, InviterId: inviter.Id,
		RewardQuota: 10, Ratio: 0.1, Status: AffiliateRewardFrozen,
	}).Error)

	require.NoError(t, MigrateAffiliateRewardsToBalance())
	require.NoError(t, MigrateAffiliateRewardsToBalance())
	require.NoError(t, DB.First(inviter, inviter.Id).Error)
	assert.Equal(t, 150, inviter.Quota)
	assert.Zero(t, inviter.AffQuota)
	assert.Equal(t, 50, inviter.AffHistoryQuota)
	var reward AffiliateReward
	require.NoError(t, DB.First(&reward, "top_up_id = ?", topUp.Id).Error)
	assert.Equal(t, AffiliateRewardGranted, reward.Status)
}

func TestGetAffiliateRewardsForAdminFiltersRangeAndTotalsAllMatches(t *testing.T) {
	truncateTables(t)

	inviter := &User{Username: "admin-list-inviter", AffCode: "admin-list-inviter-code"}
	invitee := &User{Username: "admin-list-invitee", AffCode: "admin-list-invitee-code"}
	require.NoError(t, DB.Create(inviter).Error)
	invitee.InviterId = inviter.Id
	require.NoError(t, DB.Create(invitee).Error)
	for index, createdAt := range []int64{100, 200, 300} {
		topUp := &TopUp{
			UserId: invitee.Id, Amount: 100, TradeNo: fmt.Sprintf("admin-range-order-%d", index),
			Status: common.TopUpStatusSuccess,
		}
		require.NoError(t, DB.Create(topUp).Error)
		require.NoError(t, DB.Create(&AffiliateReward{
			TopUpId: topUp.Id, InviteeId: invitee.Id, InviterId: inviter.Id,
			Sequence: index + 1, BaseQuota: 100, RewardQuota: (index + 1) * 10,
			Ratio: 0.03, Status: AffiliateRewardGranted, CreatedAt: createdAt,
		}).Error)
	}

	items, total, rangeTotal, err := GetAffiliateRewardsForAdmin(
		inviter.Id, 150, 300, &common.PageInfo{Page: 1, PageSize: 1},
	)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, int64(2), total)
	assert.Equal(t, int64(50), rangeTotal)
	assert.Equal(t, 30, items[0].RewardQuota)
	assert.Equal(t, invitee.Username, items[0].InviteeUsername)
}

func TestGetAffiliateRewardItemsFiltersAndAggregatesByRewardTime(t *testing.T) {
	originalDB := DB
	originalDatabaseType := common.MainDatabaseType()
	t.Cleanup(func() {
		DB = originalDB
		common.SetMainDatabaseType(originalDatabaseType)
	})

	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var dsn string
			switch dialect {
			case "sqlite":
				dsn = "local"
				previousPath := common.SQLitePath
				common.SQLitePath = filepath.Join(t.TempDir(), "affiliate-query.db")
				t.Cleanup(func() { common.SQLitePath = previousPath })
			case "mysql":
				dsn = os.Getenv("TEST_MYSQL_DSN")
			case "postgres":
				dsn = os.Getenv("TEST_POSTGRES_DSN")
			}
			if dsn == "" {
				t.Skip("test database DSN is not configured")
			}
			t.Setenv("AFFILIATE_QUERY_TEST_DSN", dsn)
			db, databaseType, err := chooseDB("AFFILIATE_QUERY_TEST_DSN", false)
			require.NoError(t, err)
			versionQuery := "SELECT version()"
			if dialect == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			var databaseVersion string
			require.NoError(t, db.Raw(versionQuery).Scan(&databaseVersion).Error)
			t.Logf("%s version: %s", dialect, databaseVersion)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { _ = sqlDB.Close() })
			DB = db
			common.SetMainDatabaseType(databaseType)

			require.NoError(t, db.Migrator().DropTable(&AffiliateReward{}, &TopUp{}, &User{}))
			t.Cleanup(func() {
				_ = db.Migrator().DropTable(&AffiliateReward{}, &TopUp{}, &User{})
			})
			require.NoError(t, db.AutoMigrate(&User{}, &TopUp{}, &AffiliateReward{}))

			inviter := &User{Username: "range-inviter", AffCode: "range-inviter-code"}
			rewardedInRange := &User{Username: "range-invitee-one", AffCode: "range-invitee-one-code"}
			rewardedAfterRange := &User{Username: "range-invitee-two", AffCode: "range-invitee-two-code"}
			withoutGrantedReward := &User{Username: "range-invitee-three", AffCode: "range-invitee-three-code"}
			require.NoError(t, DB.Create(inviter).Error)
			for _, invitee := range []*User{rewardedInRange, rewardedAfterRange, withoutGrantedReward} {
				invitee.InviterId = inviter.Id
				require.NoError(t, DB.Create(invitee).Error)
			}

			rewardSpecs := []struct {
				inviteeId   int
				createdAt   int64
				rewardQuota int
				status      string
			}{
				{inviteeId: rewardedInRange.Id, createdAt: 100, rewardQuota: 10, status: AffiliateRewardGranted},
				{inviteeId: rewardedInRange.Id, createdAt: 200, rewardQuota: 20, status: AffiliateRewardGranted},
				{inviteeId: rewardedAfterRange.Id, createdAt: 300, rewardQuota: 30, status: AffiliateRewardGranted},
				{inviteeId: withoutGrantedReward.Id, createdAt: 200, rewardQuota: 40, status: AffiliateRewardFrozen},
			}
			for index, spec := range rewardSpecs {
				topUp := &TopUp{
					UserId: spec.inviteeId, Amount: 100, TradeNo: fmt.Sprintf("range-order-%d", index),
					Status: common.TopUpStatusSuccess,
				}
				require.NoError(t, DB.Create(topUp).Error)
				require.NoError(t, DB.Create(&AffiliateReward{
					TopUpId: topUp.Id, InviteeId: spec.inviteeId, InviterId: inviter.Id,
					Sequence: index + 1, RewardQuota: spec.rewardQuota, Ratio: 0.1,
					Status: spec.status, CreatedAt: spec.createdAt,
				}).Error)
			}

			items, total, err := GetAffiliateRewardItems(
				inviter.Id, 150, 250, &common.PageInfo{Page: 1, PageSize: 10},
			)
			require.NoError(t, err)
			require.Len(t, items, 1)
			assert.Equal(t, int64(1), total)
			assert.Equal(t, rewardedInRange.Id, items[0].InviteeId)
			assert.Equal(t, int64(20), items[0].RewardQuota)
			assert.Equal(t, int64(200), items[0].LastRewardAt)

			allItems, total, err := GetAffiliateRewardItems(
				inviter.Id, 0, 0, &common.PageInfo{Page: 1, PageSize: 10},
			)
			require.NoError(t, err)
			require.Len(t, allItems, 3)
			assert.Equal(t, int64(3), total)
			itemByInvitee := make(map[int]AffiliateRewardItem, len(allItems))
			for _, item := range allItems {
				itemByInvitee[item.InviteeId] = item
			}
			assert.Equal(t, int64(30), itemByInvitee[rewardedInRange.Id].RewardQuota)
			assert.Zero(t, itemByInvitee[withoutGrantedReward.Id].RewardQuota)
		})
	}
}

func TestAffiliateRewardDirectBalanceMigrationDatabaseMatrix(t *testing.T) {
	originalDB := DB
	originalDatabaseType := common.MainDatabaseType()
	t.Cleanup(func() {
		DB = originalDB
		common.SetMainDatabaseType(originalDatabaseType)
	})

	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var dsn string
			switch dialect {
			case "sqlite":
				dsn = "local"
				previousPath := common.SQLitePath
				common.SQLitePath = filepath.Join(t.TempDir(), "affiliate-migration.db")
				t.Cleanup(func() { common.SQLitePath = previousPath })
			case "mysql":
				dsn = os.Getenv("TEST_MYSQL_DSN")
			case "postgres":
				dsn = os.Getenv("TEST_POSTGRES_DSN")
			}
			if dsn == "" {
				t.Skip("test database DSN is not configured")
			}
			t.Setenv("AFFILIATE_MIGRATION_TEST_DSN", dsn)
			db, databaseType, err := chooseDB("AFFILIATE_MIGRATION_TEST_DSN", false)
			require.NoError(t, err)
			versionQuery := "SELECT version()"
			if dialect == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			var databaseVersion string
			require.NoError(t, db.Raw(versionQuery).Scan(&databaseVersion).Error)
			t.Logf("%s version: %s", dialect, databaseVersion)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { _ = sqlDB.Close() })
			DB = db
			common.SetMainDatabaseType(databaseType)

			require.NoError(t, db.Migrator().DropTable(&AffiliateReward{}, &TopUp{}, &User{}, &Option{}))
			t.Cleanup(func() {
				_ = db.Migrator().DropTable(&AffiliateReward{}, &TopUp{}, &User{}, &Option{})
			})

			// Fresh database migration is repeatable and leaves no balance changes.
			require.NoError(t, db.AutoMigrate(&User{}, &Option{}, &TopUp{}, &AffiliateReward{}))
			require.NoError(t, MigrateAffiliateRewardsToBalance())
			require.NoError(t, MigrateAffiliateRewardsToBalance())

			// Simulate an upgrade from the legacy frozen-balance model.
			require.NoError(t, db.Migrator().DropTable(&AffiliateReward{}, &TopUp{}, &User{}, &Option{}))
			require.NoError(t, db.AutoMigrate(&User{}, &Option{}, &TopUp{}, &AffiliateReward{}))
			require.NoError(t, db.Migrator().DropColumn(&User{}, "affiliate_reward_ratio"))
			legacyUser := User{Username: "legacy-matrix-user", AffCode: "legacy-matrix-code", Quota: 100, AffQuota: 40, AffHistoryQuota: 40}
			require.NoError(t, db.Omit("AffiliateRewardRatio").Create(&legacyUser).Error)
			require.NoError(t, db.Create(&AffiliateReward{
				TopUpId: 9001, InviteeId: 9002, InviterId: legacyUser.Id,
				RewardQuota: 10, Ratio: 0.1, Status: AffiliateRewardFrozen, CreatedAt: 100,
			}).Error)

			require.NoError(t, db.AutoMigrate(&User{}, &Option{}, &TopUp{}, &AffiliateReward{}))
			require.NoError(t, MigrateAffiliateRewardsToBalance())
			require.NoError(t, MigrateAffiliateRewardsToBalance())
			var migrated User
			require.NoError(t, db.First(&migrated, legacyUser.Id).Error)
			assert.Equal(t, 150, migrated.Quota)
			assert.Zero(t, migrated.AffQuota)
			assert.Equal(t, 50, migrated.AffHistoryQuota)
			var reward AffiliateReward
			require.NoError(t, db.First(&reward).Error)
			assert.Equal(t, AffiliateRewardGranted, reward.Status)
		})
	}
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
