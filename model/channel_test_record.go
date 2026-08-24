package model

import (
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const ChannelTestHistoryLimit = 60

const ChannelTestRetentionDays = 30

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

type ChannelTestAvailabilityStats struct {
	ChannelId     int   `gorm:"column:channel_id"`
	Total7d       int64 `gorm:"column:total_7d"`
	Successful7d  int64 `gorm:"column:successful_7d"`
	LatencySum7d  int64 `gorm:"column:latency_sum_7d"`
	Total15d      int64 `gorm:"column:total_15d"`
	Successful15d int64 `gorm:"column:successful_15d"`
	Total30d      int64 `gorm:"column:total_30d"`
	Successful30d int64 `gorm:"column:successful_30d"`
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
		cutoff := time.Now().Add(-ChannelTestRetentionDays * 24 * time.Hour).UnixMilli()
		return tx.Where("channel_id = ? AND trigger_type = ? AND tested_at < ?", record.ChannelId, record.TriggerType, cutoff).
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

func GetChannelTestAvailabilityStats(triggerType string, now time.Time) (map[int]ChannelTestAvailabilityStats, error) {
	triggerType = normalizeChannelTestTrigger(triggerType)
	cutoff7d := now.Add(-7 * 24 * time.Hour).UnixMilli()
	cutoff15d := now.Add(-15 * 24 * time.Hour).UnixMilli()
	cutoff30d := now.Add(-ChannelTestRetentionDays * 24 * time.Hour).UnixMilli()

	var rows []ChannelTestAvailabilityStats
	err := DB.Model(&ChannelTestRecord{}).
		Select(`channel_id,
			SUM(CASE WHEN tested_at >= ? THEN 1 ELSE 0 END) AS total_7d,
			SUM(CASE WHEN tested_at >= ? AND success = ? THEN 1 ELSE 0 END) AS successful_7d,
			SUM(CASE WHEN tested_at >= ? THEN latency_ms ELSE 0 END) AS latency_sum_7d,
			SUM(CASE WHEN tested_at >= ? THEN 1 ELSE 0 END) AS total_15d,
			SUM(CASE WHEN tested_at >= ? AND success = ? THEN 1 ELSE 0 END) AS successful_15d,
			COUNT(*) AS total_30d,
			SUM(CASE WHEN success = ? THEN 1 ELSE 0 END) AS successful_30d`,
			cutoff7d, cutoff7d, true, cutoff7d, cutoff15d, cutoff15d, true, true).
		Where("trigger_type = ? AND tested_at >= ?", triggerType, cutoff30d).
		Group("channel_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	stats := make(map[int]ChannelTestAvailabilityStats, len(rows))
	for _, row := range rows {
		stats[row.ChannelId] = row
	}
	return stats, nil
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
