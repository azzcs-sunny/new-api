package model

import (
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const ChannelTestHistoryLimit = 60

const (
	ChannelTestTriggerScheduled = "scheduled"
	ChannelTestTriggerManual    = "manual"
)

type ChannelStatusTarget struct {
	ChannelId int
	Group     string
	ModelName string
}

// GetChannelStatusTargets returns the highest-priority enabled channel for
// every active group.
func GetChannelStatusTargets(groups []string) ([]ChannelStatusTarget, error) {
	allowed := make(map[string]struct{}, len(groups))
	for _, group := range groups {
		group = strings.TrimSpace(group)
		if group != "" {
			allowed[group] = struct{}{}
		}
	}

	var channels []Channel
	if err := DB.Select("id", "test_model", "models", commonGroupCol, "priority").
		Where("status = ?", common.ChannelStatusEnabled).
		Find(&channels).Error; err != nil {
		return nil, err
	}

	type candidate struct {
		target   ChannelStatusTarget
		priority int64
	}
	selected := make(map[string]candidate)
	for _, channel := range channels {
		for _, group := range channel.GetGroups() {
			if len(allowed) > 0 {
				if _, ok := allowed[group]; !ok {
					continue
				}
			}
			current, exists := selected[group]
			priority := channel.GetPriority()
			if exists && (priority < current.priority || (priority == current.priority && channel.Id > current.target.ChannelId)) {
				continue
			}
			selected[group] = candidate{
				target: ChannelStatusTarget{
					ChannelId: channel.Id,
					Group:     group,
					ModelName: channel.GetTestModel(),
				},
				priority: priority,
			}
		}
	}

	targets := make([]ChannelStatusTarget, 0, len(selected))
	for _, value := range selected {
		targets = append(targets, value.target)
	}
	sort.Slice(targets, func(i, j int) bool {
		return targets[i].Group < targets[j].Group
	})
	return targets, nil
}

type ChannelTestRecord struct {
	Id          int    `json:"id" gorm:"primaryKey"`
	ChannelId   int    `json:"-" gorm:"index:idx_channel_test_record_channel_trigger_time,priority:1"`
	TriggerType string `json:"-" gorm:"size:16;default:scheduled;index:idx_channel_test_record_channel_trigger_time,priority:2"`
	ModelName   string `json:"model_name" gorm:"size:128"`
	Success     bool   `json:"success"`
	LatencyMs   int64  `json:"latency_ms"`
	TestedAt    int64  `json:"tested_at" gorm:"index:idx_channel_test_record_channel_trigger_time,priority:3"`
}

func (ChannelTestRecord) TableName() string {
	return "channel_test_records"
}

func CreateChannelTestRecord(record *ChannelTestRecord) error {
	if record == nil || record.ChannelId <= 0 || strings.TrimSpace(record.ModelName) == "" {
		return nil
	}
	if record.LatencyMs < 0 {
		record.LatencyMs = 0
	}
	record.TriggerType = normalizeChannelTestTrigger(record.TriggerType)
	return DB.Transaction(func(tx *gorm.DB) error {
		var channel Channel
		if err := lockForUpdate(tx).Select("id").First(&channel, record.ChannelId).Error; err != nil {
			return err
		}
		if err := tx.Create(record).Error; err != nil {
			return err
		}
		var keepIds []int
		if err := tx.Model(&ChannelTestRecord{}).
			Where("channel_id = ? AND trigger_type = ?", record.ChannelId, record.TriggerType).
			Order("tested_at DESC, id DESC").
			Limit(ChannelTestHistoryLimit).
			Pluck("id", &keepIds).Error; err != nil {
			return err
		}
		if len(keepIds) < ChannelTestHistoryLimit {
			return nil
		}
		return tx.Where("channel_id = ? AND trigger_type = ? AND id NOT IN ?", record.ChannelId, record.TriggerType, keepIds).
			Delete(&ChannelTestRecord{}).Error
	})
}

func GetLatestChannelTestRecords(channelId int, triggerType string, limit int) ([]ChannelTestRecord, error) {
	if limit <= 0 || limit > ChannelTestHistoryLimit {
		limit = ChannelTestHistoryLimit
	}
	triggerType = normalizeChannelTestTrigger(triggerType)
	var records []ChannelTestRecord
	err := DB.Where("channel_id = ? AND trigger_type = ?", channelId, triggerType).
		Order("tested_at DESC, id DESC").
		Limit(limit).
		Find(&records).Error
	return records, err
}

func GetChannelTestRecordsByTrigger(triggerType string) ([]ChannelTestRecord, error) {
	triggerType = normalizeChannelTestTrigger(triggerType)
	var records []ChannelTestRecord
	err := DB.Where("trigger_type = ?", triggerType).
		Order("channel_id ASC, tested_at DESC, id DESC").
		Find(&records).Error
	return records, err
}

func normalizeChannelTestTrigger(triggerType string) string {
	if triggerType == ChannelTestTriggerManual {
		return ChannelTestTriggerManual
	}
	return ChannelTestTriggerScheduled
}

// GetChannelStatusChannels excludes credentials from the status aggregation query.
func GetChannelStatusChannels() ([]Channel, error) {
	var channels []Channel
	err := DB.Omit("key").
		Order("id ASC").
		Find(&channels).Error
	return channels, err
}
