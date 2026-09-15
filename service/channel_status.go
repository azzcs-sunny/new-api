package service

import (
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

type ChannelStatusHealth string

const (
	ChannelStatusHealthUnknown     ChannelStatusHealth = "unknown"
	ChannelStatusHealthHealthy     ChannelStatusHealth = "healthy"
	ChannelStatusHealthWarning     ChannelStatusHealth = "warning"
	ChannelStatusHealthCritical    ChannelStatusHealth = "critical"
	channelStatusDegradedLatencyMs                     = 6000
)

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
	Records           []model.ChannelTestRecord `json:"records"`
}

type ChannelStatusResult struct {
	Items   []ChannelStatusItem                   `json:"items"`
	Notices []console_setting.ChannelStatusNotice `json:"notices"`
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
	targets, err := model.GetChannelStatusTargets(groups)
	if err != nil {
		return ChannelStatusResult{}, err
	}
	availabilityByChannel, err := model.GetChannelTestAvailabilityStats(model.ChannelTestTriggerScheduled, time.Now())
	if err != nil {
		return ChannelStatusResult{}, err
	}

	recordsByChannel := make(map[int][]model.ChannelTestRecord, len(targets))
	items := make([]ChannelStatusItem, 0, len(targets))
	for _, target := range targets {
		records, ok := recordsByChannel[target.ChannelId]
		if !ok {
			records, err = model.GetLatestChannelTestRecords(target.ChannelId, model.ChannelTestTriggerScheduled, model.ChannelTestHistoryLimit)
			if err != nil {
				return ChannelStatusResult{}, err
			}
			recordsByChannel[target.ChannelId] = records
		}

		item := buildChannelStatusItem(records)
		applyChannelAvailability(&item, availabilityByChannel[target.ChannelId])
		item.ChannelId = target.ChannelId
		item.ChannelName = target.ChannelName
		item.ChannelType = target.ChannelType
		item.Provider = target.Provider
		item.ChannelStatus = target.ChannelStatus
		item.Group = target.Group
		item.GroupRatios = map[string]float64{
			target.Group: ratio_setting.GetGroupRatio(target.Group),
		}
		item.ModelName = target.ModelName
		item.Models = target.Models
		if len(records) > 0 {
			item.ModelName = records[0].ModelName
		}
		items = append(items, item)
	}
	return ChannelStatusResult{Items: items, Notices: console_setting.GetChannelStatusNotices()}, nil
}

func QueryAllChannelStatus() (ChannelStatusResult, error) {
	channels, err := model.GetChannelStatusChannels()
	if err != nil {
		return ChannelStatusResult{}, err
	}
	availabilityByChannel, err := model.GetChannelTestAvailabilityStats(model.ChannelTestTriggerScheduled, time.Now())
	if err != nil {
		return ChannelStatusResult{}, err
	}
	records, err := model.GetChannelTestRecordsByTrigger(model.ChannelTestTriggerScheduled)
	if err != nil {
		return ChannelStatusResult{}, err
	}
	recordsByChannel := make(map[int][]model.ChannelTestRecord, len(channels))
	for _, record := range records {
		if len(recordsByChannel[record.ChannelId]) < model.ChannelTestHistoryLimit {
			recordsByChannel[record.ChannelId] = append(recordsByChannel[record.ChannelId], record)
		}
	}

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
	return ChannelStatusResult{Items: items, Notices: console_setting.GetChannelStatusNotices()}, nil
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
	if record.LatencyMs < channelStatusDegradedLatencyMs {
		return ChannelStatusHealthHealthy
	}
	return ChannelStatusHealthWarning
}
