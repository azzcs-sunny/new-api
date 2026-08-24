package service

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
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
	Provider          string                    `json:"provider,omitempty"`
	ChannelStatus     int                       `json:"channel_status,omitempty"`
	Group             string                    `json:"group"`
	ModelName         string                    `json:"model_name"`
	Health            ChannelStatusHealth       `json:"health"`
	LatencyMs         int64                     `json:"latency_ms"`
	RecentSuccessRate float64                   `json:"recent_success_rate"`
	LatestCheckedAt   int64                     `json:"latest_checked_at"`
	Records           []model.ChannelTestRecord `json:"records"`
}

type ChannelStatusResult struct {
	Items []ChannelStatusItem `json:"items"`
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
		item.Group = target.Group
		item.ModelName = target.ModelName
		if len(records) > 0 {
			item.ModelName = records[0].ModelName
		}
		items = append(items, item)
	}
	return ChannelStatusResult{Items: items}, nil
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
	recordsByChannel := make(map[int][]model.ChannelTestRecord, len(channels))
	for _, record := range records {
		recordsByChannel[record.ChannelId] = append(recordsByChannel[record.ChannelId], record)
	}

	items := make([]ChannelStatusItem, 0, len(channels))
	for _, channel := range channels {
		channelRecords := recordsByChannel[channel.Id]
		item := buildChannelStatusItem(channelRecords)
		item.ChannelId = channel.Id
		item.ChannelName = channel.Name
		item.Provider = constant.GetChannelTypeName(channel.Type)
		item.ChannelStatus = channel.Status
		item.Group = channel.Group
		item.ModelName = channel.GetTestModel()
		if len(channelRecords) > 0 {
			item.ModelName = channelRecords[0].ModelName
		}
		items = append(items, item)
	}
	return ChannelStatusResult{Items: items}, nil
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
