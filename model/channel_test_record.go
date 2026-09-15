package model

import (
	"regexp"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"gorm.io/gorm"
)

const ChannelTestHistoryLimit = 60

const ChannelTestRetentionDays = 30

const (
	ChannelTestTriggerScheduled = "scheduled"
	ChannelTestTriggerManual    = "manual"
)

var mediaChannelTestModelKeywords = []string{
	"image",
	"video",
	"dall-e",
	"dalle",
	"imagen",
	"flux",
	"stable-diffusion",
	"stable-image",
	"sdxl",
	"sd3",
	"midjourney",
	"cogview",
	"cogvideo",
	"seedance",
	"seedream",
	"jimeng",
	"kling",
	"vidu",
	"hailuo",
	"runway",
	"pika",
	"sora",
	"veo",
	"hunyuanvideo",
	"text-to-video",
	"image-to-video",
	"doubao-video",
}

var mediaChannelTestModelPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?:^|[._-])wan(?:x?\d|[._-])`),
	regexp.MustCompile(`(?:^|[._-])(?:t2v|i2v|s2v)(?:$|[._-])`),
}

var hiddenChannelStatusGroupKeywords = []string{"image", "video", "图片", "视频"}

func IsMediaChannelTestModel(modelName string) bool {
	normalizedName := strings.ToLower(strings.TrimSpace(modelName))
	if normalizedName == "" {
		return false
	}
	for _, keyword := range mediaChannelTestModelKeywords {
		if strings.Contains(normalizedName, keyword) {
			return true
		}
	}
	for _, pattern := range mediaChannelTestModelPatterns {
		if pattern.MatchString(normalizedName) {
			return true
		}
	}
	return false
}

func IsHiddenChannelStatusGroup(groupName string) bool {
	normalizedName := strings.ToLower(strings.TrimSpace(groupName))
	if normalizedName == "" {
		return false
	}
	for _, keyword := range hiddenChannelStatusGroupKeywords {
		if strings.Contains(normalizedName, keyword) {
			return true
		}
	}
	return false
}

type ChannelStatusTarget struct {
	ChannelId     int
	ChannelName   string
	ChannelType   int
	ChannelStatus int
	Provider      string
	Group         string
	ModelName     string
	Models        []string
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
	if err := DB.Select("id", "type", "name", "status", "test_model", "models", commonGroupCol, "priority").
		Where("status = ?", common.ChannelStatusEnabled).
		Find(&channels).Error; err != nil {
		return nil, err
	}

	type candidate struct {
		target   ChannelStatusTarget
		priority int64
	}
	selected := make(map[string]candidate)
	modelsByGroup := make(map[string]map[string]struct{})
	for _, channel := range channels {
		testModel := channel.GetTestModel()
		for _, group := range channel.GetGroups() {
			if IsHiddenChannelStatusGroup(group) {
				continue
			}
			if len(allowed) > 0 {
				if _, ok := allowed[group]; !ok {
					continue
				}
			}
			if modelsByGroup[group] == nil {
				modelsByGroup[group] = make(map[string]struct{})
			}
			for _, modelName := range channel.GetModels() {
				modelName = strings.TrimSpace(modelName)
				if modelName != "" {
					modelsByGroup[group][modelName] = struct{}{}
				}
			}
			if IsMediaChannelTestModel(testModel) {
				continue
			}
			current, exists := selected[group]
			priority := channel.GetPriority()
			if exists && (priority < current.priority || (priority == current.priority && channel.Id > current.target.ChannelId)) {
				continue
			}
			selected[group] = candidate{
				target: ChannelStatusTarget{
					ChannelId:     channel.Id,
					ChannelName:   channel.Name,
					ChannelType:   channel.Type,
					ChannelStatus: channel.Status,
					Provider:      constant.GetChannelTypeName(channel.Type),
					Group:         group,
					ModelName:     testModel,
				},
				priority: priority,
			}
		}
	}

	targets := make([]ChannelStatusTarget, 0, len(selected))
	for _, value := range selected {
		models := make([]string, 0, len(modelsByGroup[value.target.Group]))
		for modelName := range modelsByGroup[value.target.Group] {
			models = append(models, modelName)
		}
		slices.Sort(models)
		value.target.Models = models
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
	if err != nil {
		return nil, err
	}
	filtered := make([]Channel, 0, len(channels))
	for _, channel := range channels {
		if IsMediaChannelTestModel(channel.GetTestModel()) {
			continue
		}
		groups := channel.GetGroups()
		hasVisibleGroup := len(groups) == 0
		for _, group := range groups {
			if !IsHiddenChannelStatusGroup(group) {
				hasVisibleGroup = true
				break
			}
		}
		if hasVisibleGroup {
			filtered = append(filtered, channel)
		}
	}
	return filtered, nil
}
