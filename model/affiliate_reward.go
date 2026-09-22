package model

import (
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	AffiliateRewardFrozen  = "frozen"
	AffiliateRewardGranted = "granted"

	affiliateDirectBalanceMigrationKey = "migration.affiliate_rewards.direct_balance.v1"
)

// AffiliateReward records one referral rebate for a successful top-up. A
// top-up can produce at most one record, enforced by the unique TopUpId index.
type AffiliateReward struct {
	Id          int     `json:"id"`
	TopUpId     int     `json:"top_up_id" gorm:"uniqueIndex"`
	InviteeId   int     `json:"invitee_id" gorm:"index"`
	InviterId   int     `json:"inviter_id" gorm:"index"`
	Sequence    int     `json:"sequence"`
	BaseQuota   int     `json:"base_quota"`
	RewardQuota int     `json:"reward_quota"`
	Ratio       float64 `json:"ratio"`
	Status      string  `json:"status" gorm:"type:varchar(20);index"`
	CreatedAt   int64   `json:"created_at" gorm:"autoCreateTime"`
}

// AffiliateRewardItem is the safe, aggregate view shown to an inviter. It
// intentionally contains no private contact or billing information.
type AffiliateRewardItem struct {
	InviteeId    int   `json:"invitee_id"`
	JoinedAt     int64 `json:"joined_at"`
	RewardQuota  int64 `json:"reward_quota"`
	LastRewardAt int64 `json:"last_reward_at"`
}

type AffiliateRelationItem struct {
	InviteeId       int    `json:"invitee_id"`
	InviteeUsername string `json:"invitee_username"`
	InviterId       int    `json:"inviter_id"`
	InviterUsername string `json:"inviter_username"`
	JoinedAt        int64  `json:"joined_at"`
	RewardQuota     int64  `json:"reward_quota"`
}

// AffiliateRewardDetailItem is the privacy-preserving view available to an
// inviter. Order and billing identifiers are intentionally excluded.
type AffiliateRewardDetailItem struct {
	Sequence    int     `json:"sequence"`
	RewardQuota int     `json:"reward_quota"`
	Ratio       float64 `json:"ratio"`
	Status      string  `json:"status"`
	CreatedAt   int64   `json:"created_at"`
}

type AffiliateRewardAdminDetailItem struct {
	TopUpId     int     `json:"top_up_id"`
	TradeNo     string  `json:"trade_no"`
	Sequence    int     `json:"sequence"`
	BaseQuota   int     `json:"base_quota"`
	RewardQuota int     `json:"reward_quota"`
	Ratio       float64 `json:"ratio"`
	Status      string  `json:"status"`
	CreatedAt   int64   `json:"created_at"`
}

type AffiliateRewardAdminItem struct {
	AffiliateRewardAdminDetailItem
	InviteeId       int    `json:"invitee_id"`
	InviteeUsername string `json:"invitee_username"`
}

type affiliateRewardCredit struct {
	inviterId int
	quota     int
}

func (credit affiliateRewardCredit) syncCache(operation string) {
	syncCreditUserQuotaCache(credit.inviterId, credit.quota, operation+" referral reward")
}

// GetAffiliateRewardRatio returns the user's configured ratio, falling back
// to the global setting for users who have not been configured individually.
func (user *User) GetAffiliateRewardRatio() float64 {
	if user != nil && user.AffiliateRewardRatio != nil {
		return *user.AffiliateRewardRatio
	}
	return common.AffiliateRewardRatio
}

func GetAllAffiliateRelations(pageInfo *common.PageInfo) ([]AffiliateRelationItem, int64, error) {
	var total int64
	if err := DB.Model(&User{}).Where("inviter_id > 0").Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var users []struct {
		Id        int
		Username  string
		InviterId int
		CreatedAt int64
	}
	if err := DB.Model(&User{}).
		Select("id, username, inviter_id, created_at").
		Where("inviter_id > 0").Order("id desc").
		Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&users).Error; err != nil {
		return nil, 0, err
	}
	if len(users) == 0 {
		return []AffiliateRelationItem{}, total, nil
	}
	inviteeIds := make([]int, 0, len(users))
	inviterIds := make([]int, 0, len(users))
	for _, user := range users {
		inviteeIds = append(inviteeIds, user.Id)
		inviterIds = append(inviterIds, user.InviterId)
	}
	var names []struct {
		Id       int
		Username string
	}
	if err := DB.Model(&User{}).Select("id, username").Where("id IN ?", inviterIds).Find(&names).Error; err != nil {
		return nil, 0, err
	}
	nameById := make(map[int]string, len(names))
	for _, name := range names {
		nameById[name.Id] = name.Username
	}
	var aggregates []struct {
		InviteeId   int   `gorm:"column:invitee_id"`
		RewardQuota int64 `gorm:"column:reward_quota"`
	}
	if err := DB.Model(&AffiliateReward{}).
		Select("invitee_id, SUM(reward_quota) AS reward_quota").
		Where("invitee_id IN ? AND status = ?", inviteeIds, AffiliateRewardGranted).
		Group("invitee_id").Find(&aggregates).Error; err != nil {
		return nil, 0, err
	}
	aggregateByInvitee := make(map[int]int64, len(aggregates))
	for _, aggregate := range aggregates {
		aggregateByInvitee[aggregate.InviteeId] = aggregate.RewardQuota
	}
	items := make([]AffiliateRelationItem, 0, len(users))
	for _, user := range users {
		items = append(items, AffiliateRelationItem{
			InviteeId: user.Id, InviteeUsername: user.Username, InviterId: user.InviterId,
			InviterUsername: nameById[user.InviterId], JoinedAt: user.CreatedAt,
			RewardQuota: aggregateByInvitee[user.Id],
		})
	}
	return items, total, nil
}

// MigrateAffiliateRewardsToBalance moves both legacy available referral quota
// and still-frozen reward rows into the main balance exactly once.
func MigrateAffiliateRewardsToBalance() error {
	return DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&Option{
			Key: affiliateDirectBalanceMigrationKey, Value: "completed",
		})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}

		var frozen []struct {
			InviterId int   `gorm:"column:inviter_id"`
			Quota     int64 `gorm:"column:quota"`
		}
		if err := tx.Model(&AffiliateReward{}).
			Select("inviter_id, SUM(reward_quota) AS quota").
			Where("status = ?", AffiliateRewardFrozen).
			Group("inviter_id").Find(&frozen).Error; err != nil {
			return err
		}
		frozenByInviter := make(map[int]int64, len(frozen))
		for _, item := range frozen {
			frozenByInviter[item.InviterId] = item.Quota
		}

		var users []User
		if err := lockForUpdate(tx).Select("id", "quota", "aff_quota", "aff_history").
			Where("aff_quota > 0 OR id IN (?)", tx.Model(&AffiliateReward{}).Select("inviter_id").Where("status = ?", AffiliateRewardFrozen)).
			Find(&users).Error; err != nil {
			return err
		}
		for _, user := range users {
			frozenQuota := frozenByInviter[user.Id]
			credit := int64(user.AffQuota) + frozenQuota
			if credit <= 0 {
				continue
			}
			if int64(user.Quota) > int64(common.MaxWalletQuota)-credit {
				return fmt.Errorf("affiliate reward migration exceeds wallet limit for user %d", user.Id)
			}
			if err := tx.Model(&User{}).Where("id = ?", user.Id).Updates(map[string]any{
				"quota":       gorm.Expr("quota + ?", credit),
				"aff_quota":   0,
				"aff_history": gorm.Expr("aff_history + ?", frozenQuota),
			}).Error; err != nil {
				return err
			}
		}
		if err := tx.Model(&AffiliateReward{}).Where("status = ?", AffiliateRewardFrozen).
			Update("status", AffiliateRewardGranted).Error; err != nil {
			return err
		}
		return nil
	})
}

// GetAffiliateRewardItems returns the inviter's referred users with the
// aggregate rebate earned from each user's successful top-ups.
func GetAffiliateRewardItems(inviterId int, startTimestamp int64, endTimestamp int64, pageInfo *common.PageInfo) ([]AffiliateRewardItem, int64, error) {
	userQuery := DB.Model(&User{}).Where("inviter_id = ?", inviterId)
	if startTimestamp > 0 || endTimestamp > 0 {
		rewardInvitees := DB.Model(&AffiliateReward{}).
			Select("invitee_id").
			Where("inviter_id = ? AND status = ?", inviterId, AffiliateRewardGranted)
		if startTimestamp > 0 {
			rewardInvitees = rewardInvitees.Where("created_at >= ?", startTimestamp)
		}
		if endTimestamp > 0 {
			rewardInvitees = rewardInvitees.Where("created_at <= ?", endTimestamp)
		}
		userQuery = userQuery.Where("id IN (?)", rewardInvitees)
	}

	var total int64
	if err := userQuery.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var users []struct {
		Id        int
		CreatedAt int64
	}
	if err := userQuery.Session(&gorm.Session{}).
		Select("id, created_at").
		Order("id desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&users).Error; err != nil {
		return nil, 0, err
	}
	if len(users) == 0 {
		return []AffiliateRewardItem{}, total, nil
	}

	inviteeIds := make([]int, 0, len(users))
	for _, user := range users {
		inviteeIds = append(inviteeIds, user.Id)
	}
	var aggregates []struct {
		InviteeId    int   `gorm:"column:invitee_id"`
		RewardQuota  int64 `gorm:"column:reward_quota"`
		LastRewardAt int64 `gorm:"column:last_reward_at"`
	}
	aggregateQuery := DB.Model(&AffiliateReward{}).
		Where("inviter_id = ? AND status = ? AND invitee_id IN ?", inviterId, AffiliateRewardGranted, inviteeIds)
	if startTimestamp > 0 {
		aggregateQuery = aggregateQuery.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp > 0 {
		aggregateQuery = aggregateQuery.Where("created_at <= ?", endTimestamp)
	}
	if err := aggregateQuery.
		Select("invitee_id, SUM(reward_quota) AS reward_quota, MAX(created_at) AS last_reward_at").
		Group("invitee_id").
		Find(&aggregates).Error; err != nil {
		return nil, 0, err
	}

	byInvitee := make(map[int]struct {
		rewardQuota  int64
		lastRewardAt int64
	}, len(aggregates))
	for _, aggregate := range aggregates {
		byInvitee[aggregate.InviteeId] = struct {
			rewardQuota  int64
			lastRewardAt int64
		}{aggregate.RewardQuota, aggregate.LastRewardAt}
	}

	items := make([]AffiliateRewardItem, 0, len(users))
	for _, user := range users {
		aggregate := byInvitee[user.Id]
		items = append(items, AffiliateRewardItem{
			InviteeId:    user.Id,
			JoinedAt:     user.CreatedAt,
			RewardQuota:  aggregate.rewardQuota,
			LastRewardAt: aggregate.lastRewardAt,
		})
	}
	return items, total, nil
}

func GetAffiliateRewardsForAdmin(inviterId int, startTimestamp int64, endTimestamp int64, pageInfo *common.PageInfo) ([]AffiliateRewardAdminItem, int64, int64, error) {
	query := DB.Model(&AffiliateReward{}).Where("inviter_id = ? AND status = ?", inviterId, AffiliateRewardGranted)
	if startTimestamp > 0 {
		query = query.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp > 0 {
		query = query.Where("created_at <= ?", endTimestamp)
	}
	var total int64
	if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, 0, err
	}
	var rangeRewardQuota int64
	if err := query.Session(&gorm.Session{}).Select("COALESCE(SUM(reward_quota), 0)").Scan(&rangeRewardQuota).Error; err != nil {
		return nil, 0, 0, err
	}
	var rewards []AffiliateReward
	if err := query.Session(&gorm.Session{}).Order("created_at desc, id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&rewards).Error; err != nil {
		return nil, 0, 0, err
	}
	inviteeIds := make([]int, 0, len(rewards))
	for _, reward := range rewards {
		inviteeIds = append(inviteeIds, reward.InviteeId)
	}
	var invitees []User
	if len(inviteeIds) > 0 {
		if err := DB.Unscoped().Select("id", "username").Where("id IN ?", inviteeIds).Find(&invitees).Error; err != nil {
			return nil, 0, 0, err
		}
	}
	usernameById := make(map[int]string, len(invitees))
	for _, invitee := range invitees {
		usernameById[invitee.Id] = invitee.Username
	}
	items := make([]AffiliateRewardAdminItem, 0, len(rewards))
	for _, reward := range rewards {
		items = append(items, AffiliateRewardAdminItem{
			AffiliateRewardAdminDetailItem: AffiliateRewardAdminDetailItem{TopUpId: reward.TopUpId, Sequence: reward.Sequence, BaseQuota: reward.BaseQuota, RewardQuota: reward.RewardQuota, Ratio: reward.Ratio, Status: reward.Status, CreatedAt: reward.CreatedAt},
			InviteeId:                      reward.InviteeId, InviteeUsername: usernameById[reward.InviteeId],
		})
	}
	return items, total, rangeRewardQuota, nil
}

func GetAffiliateRewardDetails(inviterId int, inviteeId int, pageInfo *common.PageInfo) ([]AffiliateRewardDetailItem, int64, error) {
	if inviterId <= 0 || inviteeId <= 0 {
		return []AffiliateRewardDetailItem{}, 0, nil
	}
	query := DB.Model(&AffiliateReward{}).
		Where("inviter_id = ? AND invitee_id = ?", inviterId, inviteeId)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []AffiliateRewardDetailItem
	if err := query.
		Select("sequence, reward_quota, ratio, status, created_at").
		Order("sequence ASC").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func GetAffiliateRewardAdminDetails(inviterId int, inviteeId int, pageInfo *common.PageInfo) ([]AffiliateRewardAdminDetailItem, int64, error) {
	if inviterId <= 0 || inviteeId <= 0 {
		return []AffiliateRewardAdminDetailItem{}, 0, nil
	}
	query := DB.Model(&AffiliateReward{}).
		Where("inviter_id = ? AND invitee_id = ?", inviterId, inviteeId)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rewards []AffiliateReward
	if err := query.Select("top_up_id", "sequence", "base_quota", "reward_quota", "ratio", "status", "created_at").
		Order("sequence ASC").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&rewards).Error; err != nil {
		return nil, 0, err
	}
	if len(rewards) == 0 {
		return []AffiliateRewardAdminDetailItem{}, total, nil
	}

	topUpIds := make([]int, 0, len(rewards))
	for _, reward := range rewards {
		topUpIds = append(topUpIds, reward.TopUpId)
	}
	var topUps []struct {
		Id      int
		TradeNo string
	}
	if err := DB.Model(&TopUp{}).Select("id", "trade_no").Where("id IN ?", topUpIds).Find(&topUps).Error; err != nil {
		return nil, 0, err
	}
	tradeNoByTopUpId := make(map[int]string, len(topUps))
	for _, topUp := range topUps {
		tradeNoByTopUpId[topUp.Id] = topUp.TradeNo
	}

	items := make([]AffiliateRewardAdminDetailItem, 0, len(rewards))
	for _, reward := range rewards {
		items = append(items, AffiliateRewardAdminDetailItem{
			TopUpId:     reward.TopUpId,
			TradeNo:     tradeNoByTopUpId[reward.TopUpId],
			Sequence:    reward.Sequence,
			BaseQuota:   reward.BaseQuota,
			RewardQuota: reward.RewardQuota,
			Ratio:       reward.Ratio,
			Status:      reward.Status,
			CreatedAt:   reward.CreatedAt,
		})
	}
	return items, total, nil
}

// applyAffiliateTopUpRewardTx settles the referral rebate as part of the
// top-up transaction. The invitee row is locked before counting successful
// top-ups, so concurrent payments cannot both become the same reward sequence.
func applyAffiliateTopUpRewardTx(tx *gorm.DB, topUp *TopUp, creditedQuota int, credit *affiliateRewardCredit) error {
	if tx == nil || topUp == nil || topUp.Id == 0 || creditedQuota <= 0 {
		return nil
	}
	if topUp.PaymentMethod == PaymentMethodRedemption || topUp.PaymentProvider == PaymentProviderRedemption {
		return nil
	}
	var invitee User
	if err := lockForUpdate(tx).Select("id", "inviter_id").Where("id = ?", topUp.UserId).First(&invitee).Error; err != nil {
		return err
	}
	if invitee.InviterId <= 0 || invitee.InviterId == invitee.Id {
		return nil
	}

	var inviter User
	if err := tx.Select("affiliate_reward_ratio").Where("id = ?", invitee.InviterId).First(&inviter).Error; err != nil {
		return err
	}
	ratio := inviter.GetAffiliateRewardRatio()
	if !operation_setting.IsPaymentComplianceConfirmed() || ratio <= 0 || ratio > 1 || math.IsNaN(ratio) || math.IsInf(ratio, 0) {
		return nil
	}

	var successfulTopUps int64
	if err := tx.Model(&TopUp{}).
		Where("user_id = ? AND status = ? AND amount > ?", invitee.Id, common.TopUpStatusSuccess, 0).
		Count(&successfulTopUps).Error; err != nil {
		return err
	}
	if successfulTopUps <= 0 {
		return nil
	}

	rewardQuota, err := common.QuotaFromFloatStrict(float64(creditedQuota) * ratio)
	if err != nil {
		return err
	}
	if rewardQuota <= 0 {
		return nil
	}
	reward := &AffiliateReward{
		TopUpId:     topUp.Id,
		InviteeId:   invitee.Id,
		InviterId:   invitee.InviterId,
		Sequence:    int(successfulTopUps),
		BaseQuota:   creditedQuota,
		RewardQuota: rewardQuota,
		Ratio:       ratio,
		Status:      AffiliateRewardGranted,
	}
	if err := tx.Create(reward).Error; err != nil {
		return err
	}
	maxCurrentQuota := common.MaxWalletQuota - rewardQuota
	result := tx.Model(&User{}).Where("id = ? AND quota <= ?", invitee.InviterId, maxCurrentQuota).Updates(map[string]any{
		"quota":       gorm.Expr("quota + ?", rewardQuota),
		"aff_history": gorm.Expr("aff_history + ?", rewardQuota),
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrWalletQuotaLimitExceeded
	}
	if credit != nil {
		credit.inviterId = invitee.InviterId
		credit.quota = rewardQuota
	}
	return nil
}
