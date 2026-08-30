package model

import (
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

const (
	AffiliateRewardMaxTopUps           = 3
	AffiliateRewardFreezeSeconds int64 = 24 * 60 * 60
	AffiliateRewardFrozen              = "frozen"
	AffiliateRewardGranted             = "granted"
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
	TopUpCount   int   `json:"top_up_count"`
	RewardQuota  int64 `json:"reward_quota"`
	FrozenQuota  int64 `json:"frozen_quota"`
	LastRewardAt int64 `json:"last_reward_at"`
}

type AffiliateRelationItem struct {
	InviteeId       int    `json:"invitee_id"`
	InviteeUsername string `json:"invitee_username"`
	InviterId       int    `json:"inviter_id"`
	InviterUsername string `json:"inviter_username"`
	JoinedAt        int64  `json:"joined_at"`
	TopUpCount      int    `json:"top_up_count"`
	RewardQuota     int64  `json:"reward_quota"`
	FrozenQuota     int64  `json:"frozen_quota"`
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
		TopUpCount  int64 `gorm:"column:top_up_count"`
		RewardQuota int64 `gorm:"column:reward_quota"`
		FrozenQuota int64 `gorm:"column:frozen_quota"`
	}
	if err := DB.Model(&AffiliateReward{}).
		Select("invitee_id, COUNT(*) AS top_up_count, SUM(CASE WHEN status = ? THEN reward_quota ELSE 0 END) AS reward_quota, SUM(CASE WHEN status = ? THEN reward_quota ELSE 0 END) AS frozen_quota", AffiliateRewardGranted, AffiliateRewardFrozen).
		Where("invitee_id IN ? AND status IN ?", inviteeIds, []string{AffiliateRewardGranted, AffiliateRewardFrozen}).
		Group("invitee_id").Find(&aggregates).Error; err != nil {
		return nil, 0, err
	}
	aggregateByInvitee := make(map[int]struct{ topUpCount, rewardQuota, frozenQuota int64 }, len(aggregates))
	for _, aggregate := range aggregates {
		aggregateByInvitee[aggregate.InviteeId] = struct{ topUpCount, rewardQuota, frozenQuota int64 }{aggregate.TopUpCount, aggregate.RewardQuota, aggregate.FrozenQuota}
	}
	items := make([]AffiliateRelationItem, 0, len(users))
	for _, user := range users {
		aggregate := aggregateByInvitee[user.Id]
		items = append(items, AffiliateRelationItem{
			InviteeId: user.Id, InviteeUsername: user.Username, InviterId: user.InviterId,
			InviterUsername: nameById[user.InviterId], JoinedAt: user.CreatedAt,
			TopUpCount: int(aggregate.topUpCount), RewardQuota: aggregate.rewardQuota, FrozenQuota: aggregate.frozenQuota,
		})
	}
	return items, total, nil
}

// ReleaseAffiliateRewards makes rebates available after the 24-hour holding
// period. It is idempotent and safe for concurrent requests.
func ReleaseAffiliateRewards(inviterId int) error {
	if inviterId <= 0 {
		return nil
	}
	cutoff := common.GetTimestamp() - AffiliateRewardFreezeSeconds
	return DB.Transaction(func(tx *gorm.DB) error {
		var rewards []AffiliateReward
		if err := lockForUpdate(tx).
			Where("inviter_id = ? AND status = ? AND created_at <= ?", inviterId, AffiliateRewardFrozen, cutoff).
			Find(&rewards).Error; err != nil {
			return err
		}
		if len(rewards) == 0 {
			return nil
		}
		var total int64
		for _, reward := range rewards {
			total += int64(reward.RewardQuota)
		}
		if total > 0 {
			if err := tx.Model(&User{}).Where("id = ?", inviterId).Updates(map[string]interface{}{
				"aff_quota":   gorm.Expr("aff_quota + ?", total),
				"aff_history": gorm.Expr("aff_history + ?", total),
			}).Error; err != nil {
				return err
			}
		}
		return tx.Model(&AffiliateReward{}).
			Where("id IN ?", rewardIds(rewards)).
			Update("status", AffiliateRewardGranted).Error
	})
}

func rewardIds(rewards []AffiliateReward) []int {
	ids := make([]int, 0, len(rewards))
	for _, reward := range rewards {
		ids = append(ids, reward.Id)
	}
	return ids
}

// GetAffiliateRewardItems returns the inviter's referred users with the
// aggregate rebate earned from each user's first eligible top-ups.
func GetAffiliateRewardItems(inviterId int, pageInfo *common.PageInfo) ([]AffiliateRewardItem, int64, error) {
	if err := ReleaseAffiliateRewards(inviterId); err != nil {
		return nil, 0, err
	}
	var total int64
	if err := DB.Model(&User{}).Where("inviter_id = ?", inviterId).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var users []struct {
		Id        int
		CreatedAt int64
	}
	if err := DB.Model(&User{}).
		Select("id, created_at").
		Where("inviter_id = ?", inviterId).
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
		TopUpCount   int64 `gorm:"column:top_up_count"`
		RewardQuota  int64 `gorm:"column:reward_quota"`
		FrozenQuota  int64 `gorm:"column:frozen_quota"`
		LastRewardAt int64 `gorm:"column:last_reward_at"`
	}
	if err := DB.Model(&AffiliateReward{}).
		Select("invitee_id, COUNT(*) AS top_up_count, SUM(CASE WHEN status = ? THEN reward_quota ELSE 0 END) AS reward_quota, SUM(CASE WHEN status = ? THEN reward_quota ELSE 0 END) AS frozen_quota, MAX(created_at) AS last_reward_at", AffiliateRewardGranted, AffiliateRewardFrozen).
		Where("inviter_id = ? AND status IN ? AND invitee_id IN ?", inviterId, []string{AffiliateRewardGranted, AffiliateRewardFrozen}, inviteeIds).
		Group("invitee_id").
		Find(&aggregates).Error; err != nil {
		return nil, 0, err
	}

	byInvitee := make(map[int]struct {
		topUpCount   int64
		rewardQuota  int64
		frozenQuota  int64
		lastRewardAt int64
	}, len(aggregates))
	for _, aggregate := range aggregates {
		byInvitee[aggregate.InviteeId] = struct {
			topUpCount   int64
			rewardQuota  int64
			frozenQuota  int64
			lastRewardAt int64
		}{aggregate.TopUpCount, aggregate.RewardQuota, aggregate.FrozenQuota, aggregate.LastRewardAt}
	}

	items := make([]AffiliateRewardItem, 0, len(users))
	for _, user := range users {
		aggregate := byInvitee[user.Id]
		items = append(items, AffiliateRewardItem{
			InviteeId:    user.Id,
			JoinedAt:     user.CreatedAt,
			TopUpCount:   int(aggregate.topUpCount),
			RewardQuota:  aggregate.rewardQuota,
			FrozenQuota:  aggregate.frozenQuota,
			LastRewardAt: aggregate.lastRewardAt,
		})
	}
	return items, total, nil
}

func GetAffiliateRewardDetails(inviterId int, inviteeId int, pageInfo *common.PageInfo) ([]AffiliateRewardDetailItem, int64, error) {
	if inviterId <= 0 || inviteeId <= 0 {
		return []AffiliateRewardDetailItem{}, 0, nil
	}
	if err := ReleaseAffiliateRewards(inviterId); err != nil {
		return nil, 0, err
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
	if err := ReleaseAffiliateRewards(inviterId); err != nil {
		return nil, 0, err
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
func applyAffiliateTopUpRewardTx(tx *gorm.DB, topUp *TopUp, creditedQuota int) error {
	if tx == nil || topUp == nil || topUp.Id == 0 || creditedQuota <= 0 {
		return nil
	}
	ratio := common.AffiliateRewardRatio
	if !operation_setting.IsPaymentComplianceConfirmed() || ratio <= 0 || ratio > 1 || math.IsNaN(ratio) || math.IsInf(ratio, 0) {
		return nil
	}

	var invitee User
	if err := lockForUpdate(tx).Select("id", "inviter_id").Where("id = ?", topUp.UserId).First(&invitee).Error; err != nil {
		return err
	}
	if invitee.InviterId <= 0 || invitee.InviterId == invitee.Id {
		return nil
	}

	var successfulTopUps int64
	if err := tx.Model(&TopUp{}).
		Where("user_id = ? AND status = ? AND amount > ?", invitee.Id, common.TopUpStatusSuccess, 0).
		Count(&successfulTopUps).Error; err != nil {
		return err
	}
	if successfulTopUps <= 0 || successfulTopUps > AffiliateRewardMaxTopUps {
		return nil
	}

	rewardQuota, err := common.QuotaFromFloatStrict(float64(creditedQuota) * ratio)
	if err != nil {
		return err
	}
	reward := &AffiliateReward{
		TopUpId:     topUp.Id,
		InviteeId:   invitee.Id,
		InviterId:   invitee.InviterId,
		Sequence:    int(successfulTopUps),
		BaseQuota:   creditedQuota,
		RewardQuota: rewardQuota,
		Ratio:       ratio,
		Status:      AffiliateRewardFrozen,
	}
	if err := tx.Create(reward).Error; err != nil {
		return err
	}
	return nil
}
