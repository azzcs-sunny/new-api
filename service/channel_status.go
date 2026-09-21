package service

import (
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

type ChannelStatusHealth string

const (
	ChannelStatusHealthUnknown  ChannelStatusHealth = "unknown"
	ChannelStatusHealthHealthy  ChannelStatusHealth = "healthy"
	ChannelStatusHealthWarning  ChannelStatusHealth = "warning"
	ChannelStatusHealthCritical ChannelStatusHealth = "critical"
)

var channelStatusSettingsMu sync.Mutex

type ChannelStatusItem struct {
	ChannelId         int                       `json:"channel_id,omitempty"`
	ChannelName       string                    `json:"channel_name,omitempty"`
	ChannelType       int                       `json:"channel_type,omitempty"`
	Provider          string                    `json:"provider,omitempty"`
	ChannelStatus     int                       `json:"channel_status,omitempty"`
	Group             string                    `json:"group"`
	GroupRatios       map[string]float64        `json:"group_ratios,omitempty"`
	ModelName         string                    `json:"model_name"`
	Models            []string                  `json:"models"`
	Health            ChannelStatusHealth       `json:"health"`
	LatencyMs         int64                     `json:"latency_ms"`
	RecentSuccessRate float64                   `json:"recent_success_rate"`
	Availability7d    float64                   `json:"availability_7d"`
	Availability15d   float64                   `json:"availability_15d"`
	Availability30d   float64                   `json:"availability_30d"`
	Availability7dN   int64                     `json:"availability_7d_samples"`
	Availability15dN  int64                     `json:"availability_15d_samples"`
	Availability30dN  int64                     `json:"availability_30d_samples"`
	AverageLatency7d  *int64                    `json:"avg_latency_7d_ms"`
	LatestCheckedAt   int64                     `json:"latest_checked_at"`
	ActiveTestEnabled *bool                     `json:"active_test_enabled,omitempty"`
	Visible           bool                      `json:"visible"`
	Records           []model.ChannelTestRecord `json:"records"`
}

type ChannelStatusResult struct {
	Items             []ChannelStatusItem                   `json:"items"`
	Notices           []console_setting.ChannelStatusNotice `json:"notices"`
	DegradedLatencyMs int64                                 `json:"degraded_latency_ms"`
}

func RecordChannelTestResult(channel *model.Channel, triggerType string, modelName string, latencyMs int64, success bool) {
	if channel == nil {
		return
	}
	if modelName == "" {
		modelName = channel.GetTestModel()
	}
	err := model.CreateChannelTestRecord(&model.ChannelTestRecord{
		ChannelId:   channel.Id,
		TriggerType: triggerType,
		ModelName:   modelName,
		Success:     success,
		LatencyMs:   latencyMs,
		TestedAt:    time.Now().UnixMilli(),
	})
	if err != nil {
		common.SysError("failed to record channel test result: " + err.Error())
	}
}

func QueryChannelStatus(groups []string) (ChannelStatusResult, error) {
	channels, err := model.GetChannelStatusChannels()
	if err != nil {
		return ChannelStatusResult{}, err
	}
	records, err := model.GetChannelTestRecordsByTrigger(model.ChannelTestTriggerScheduled)
	if err != nil {
		return ChannelStatusResult{}, err
	}
	recordsByChannel, availabilityByChannel := aggregateCurrentChannelTestRecords(channels, records, time.Now())
	activeGroups := make(map[string]struct{}, len(groups))
	for _, group := range groups {
		group = strings.TrimSpace(group)
		if group != "" {
			activeGroups[group] = struct{}{}
		}
	}

	items := make([]ChannelStatusItem, 0, len(channels))
	for _, channel := range channels {
		if channel.Status != common.ChannelStatusEnabled || !operation_setting.IsChannelStatusVisible(channel.Id) || model.IsMediaChannelTestModel(channel.GetTestModel()) {
			continue
		}
		visibleGroups := make([]string, 0)
		groupRatios := make(map[string]float64)
		for _, group := range channel.GetGroups() {
			if model.IsHiddenChannelStatusGroup(group) {
				continue
			}
			if len(activeGroups) > 0 {
				if _, ok := activeGroups[group]; !ok {
					continue
				}
			}
			visibleGroups = append(visibleGroups, group)
			groupRatios[group] = ratio_setting.GetGroupRatio(group)
		}
		if len(visibleGroups) == 0 {
			continue
		}

		channelRecords := recordsByChannel[channel.Id]
		item := buildChannelStatusItem(channelRecords)
		applyChannelAvailability(&item, availabilityByChannel[channel.Id])
		item.ChannelId = channel.Id
		item.ChannelName = channel.Name
		item.ChannelType = channel.Type
		item.Provider = constant.GetChannelTypeName(channel.Type)
		item.ChannelStatus = channel.Status
		item.Group = strings.Join(visibleGroups, ",")
		item.GroupRatios = groupRatios
		item.ModelName = channel.GetTestModel()
		item.Models = channel.GetModels()
		item.Visible = true
		if len(channelRecords) > 0 {
			item.ModelName = channelRecords[0].ModelName
		}
		items = append(items, item)
	}
	return ChannelStatusResult{
		Items:             items,
		Notices:           console_setting.GetChannelStatusNotices(),
		DegradedLatencyMs: operation_setting.GetChannelStatusHealthyLatencyMs(),
	}, nil
}

func QueryAllChannelStatus() (ChannelStatusResult, error) {
	channels, err := model.GetChannelStatusChannels()
	if err != nil {
		return ChannelStatusResult{}, err
	}
	records, err := model.GetChannelTestRecordsByTrigger(model.ChannelTestTriggerScheduled)
	if err != nil {
		return ChannelStatusResult{}, err
	}
	recordsByChannel, availabilityByChannel := aggregateCurrentChannelTestRecords(channels, records, time.Now())

	items := make([]ChannelStatusItem, 0, len(channels))
	for _, channel := range channels {
		channelRecords := recordsByChannel[channel.Id]
		item := buildChannelStatusItem(channelRecords)
		applyChannelAvailability(&item, availabilityByChannel[channel.Id])
		item.ChannelId = channel.Id
		item.ChannelName = channel.Name
		item.ChannelType = channel.Type
		item.Provider = constant.GetChannelTypeName(channel.Type)
		item.ChannelStatus = channel.Status
		activeTestEnabled := operation_setting.IsChannelActiveTestEnabled(channel.Id)
		item.ActiveTestEnabled = &activeTestEnabled
		item.Visible = operation_setting.IsChannelStatusVisible(channel.Id)
		item.Group = channel.Group
		item.GroupRatios = make(map[string]float64)
		visibleGroups := make([]string, 0)
		for _, group := range channel.GetGroups() {
			if model.IsHiddenChannelStatusGroup(group) {
				continue
			}
			visibleGroups = append(visibleGroups, group)
			item.GroupRatios[group] = ratio_setting.GetGroupRatio(group)
		}
		if len(visibleGroups) > 0 {
			item.Group = strings.Join(visibleGroups, ",")
		}
		item.ModelName = channel.GetTestModel()
		item.Models = channel.GetModels()
		if len(channelRecords) > 0 {
			item.ModelName = channelRecords[0].ModelName
		}
		items = append(items, item)
	}
	return ChannelStatusResult{
		Items:             items,
		Notices:           console_setting.GetChannelStatusNotices(),
		DegradedLatencyMs: operation_setting.GetChannelStatusHealthyLatencyMs(),
	}, nil
}

func UpdateChannelStatusVisibility(channelId int, visible bool) error {
	if channelId <= 0 {
		return fmt.Errorf("invalid channel ID")
	}
	if _, err := model.GetChannelById(channelId, false); err != nil {
		return err
	}

	channelStatusSettingsMu.Lock()
	defer channelStatusSettingsMu.Unlock()
	hiddenChannelIds := operation_setting.GetChannelStatusHiddenChannelIds()
	hiddenIndex := slices.Index(hiddenChannelIds, channelId)
	if visible && hiddenIndex >= 0 {
		hiddenChannelIds = slices.Delete(hiddenChannelIds, hiddenIndex, hiddenIndex+1)
	} else if !visible && hiddenIndex < 0 {
		hiddenChannelIds = append(hiddenChannelIds, channelId)
	}
	slices.Sort(hiddenChannelIds)
	encoded, err := common.Marshal(hiddenChannelIds)
	if err != nil {
		return err
	}
	return model.UpdateOption(operation_setting.ChannelStatusHiddenChannelIdsOptionKey, string(encoded))
}

func UpdateChannelActiveTestEnabled(channelId int, enabled bool) error {
	if channelId <= 0 {
		return fmt.Errorf("invalid channel ID")
	}
	if _, err := model.GetChannelById(channelId, false); err != nil {
		return err
	}

	channelStatusSettingsMu.Lock()
	defer channelStatusSettingsMu.Unlock()
	disabledChannelIds := operation_setting.GetChannelTestDisabledChannelIds()
	disabledIndex := slices.Index(disabledChannelIds, channelId)
	if enabled && disabledIndex >= 0 {
		disabledChannelIds = slices.Delete(disabledChannelIds, disabledIndex, disabledIndex+1)
	} else if !enabled && disabledIndex < 0 {
		disabledChannelIds = append(disabledChannelIds, channelId)
	}
	slices.Sort(disabledChannelIds)
	encoded, err := common.Marshal(disabledChannelIds)
	if err != nil {
		return err
	}
	return model.UpdateOption(operation_setting.ChannelTestDisabledChannelIdsOptionKey, string(encoded))
}

func UpdateChannelStatusHealthySeconds(seconds int) error {
	return model.UpdateOption(operation_setting.ChannelStatusHealthySecondsOptionKey, fmt.Sprintf("%d", seconds))
}

func ClearChannelStatusTestRecords(channelId int) (int64, error) {
	if channelId <= 0 {
		return 0, fmt.Errorf("invalid channel ID")
	}
	if _, err := model.GetChannelById(channelId, false); err != nil {
		return 0, err
	}
	return model.DeleteChannelTestRecords(channelId, model.ChannelTestTriggerScheduled)
}

func aggregateCurrentChannelTestRecords(
	channels []model.Channel,
	records []model.ChannelTestRecord,
	now time.Time,
) (map[int][]model.ChannelTestRecord, map[int]model.ChannelTestAvailabilityStats) {
	createdAtByChannel := make(map[int]int64, len(channels))
	for _, channel := range channels {
		createdAtByChannel[channel.Id] = channel.CreatedTime * 1000
	}

	recordsByChannel := make(map[int][]model.ChannelTestRecord, len(channels))
	availabilityByChannel := make(map[int]model.ChannelTestAvailabilityStats, len(channels))
	cutoff7d := now.Add(-7 * 24 * time.Hour).UnixMilli()
	cutoff15d := now.Add(-15 * 24 * time.Hour).UnixMilli()
	cutoff30d := now.Add(-model.ChannelTestRetentionDays * 24 * time.Hour).UnixMilli()
	for _, record := range records {
		createdAt, exists := createdAtByChannel[record.ChannelId]
		if !exists || createdAt > 0 && record.TestedAt < createdAt {
			continue
		}
		if len(recordsByChannel[record.ChannelId]) < model.ChannelTestHistoryLimit {
			recordsByChannel[record.ChannelId] = append(recordsByChannel[record.ChannelId], record)
		}
		if record.TestedAt < cutoff30d {
			continue
		}

		stats := availabilityByChannel[record.ChannelId]
		stats.ChannelId = record.ChannelId
		stats.Total30d++
		if record.Success {
			stats.Successful30d++
		}
		if record.TestedAt >= cutoff15d {
			stats.Total15d++
			if record.Success {
				stats.Successful15d++
			}
		}
		if record.TestedAt >= cutoff7d {
			stats.Total7d++
			stats.LatencySum7d += record.LatencyMs
			if record.Success {
				stats.Successful7d++
			}
		}
		availabilityByChannel[record.ChannelId] = stats
	}
	return recordsByChannel, availabilityByChannel
}

func applyChannelAvailability(item *ChannelStatusItem, stats model.ChannelTestAvailabilityStats) {
	item.Availability7dN = stats.Total7d
	item.Availability15dN = stats.Total15d
	item.Availability30dN = stats.Total30d
	if stats.Total7d > 0 {
		item.Availability7d = float64(stats.Successful7d) / float64(stats.Total7d) * 100
		averageLatency := stats.LatencySum7d / stats.Total7d
		item.AverageLatency7d = &averageLatency
	}
	if stats.Total15d > 0 {
		item.Availability15d = float64(stats.Successful15d) / float64(stats.Total15d) * 100
	}
	if stats.Total30d > 0 {
		item.Availability30d = float64(stats.Successful30d) / float64(stats.Total30d) * 100
	}
}

func buildChannelStatusItem(records []model.ChannelTestRecord) ChannelStatusItem {
	item := ChannelStatusItem{
		Health:  ChannelStatusHealthUnknown,
		Records: make([]model.ChannelTestRecord, len(records)),
	}
	if len(records) == 0 {
		return item
	}

	latest := records[0]
	item.LatencyMs = latest.LatencyMs
	item.LatestCheckedAt = latest.TestedAt
	item.Health = channelTestHealth(latest)
	succeeded := 0
	for i := range records {
		item.Records[len(records)-1-i] = records[i]
		if records[i].Success {
			succeeded++
		}
	}
	item.RecentSuccessRate = float64(succeeded) / float64(len(records)) * 100
	return item
}

func channelTestHealth(record model.ChannelTestRecord) ChannelStatusHealth {
	if !record.Success {
		return ChannelStatusHealthCritical
	}
	if record.LatencyMs < operation_setting.GetChannelStatusHealthyLatencyMs() {
		return ChannelStatusHealthHealthy
	}
	return ChannelStatusHealthWarning
}
