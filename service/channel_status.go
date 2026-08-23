package service

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type ChannelStatusHealth string

const (
	ChannelStatusHealthUnknown  ChannelStatusHealth = "unknown"
	ChannelStatusHealthHealthy  ChannelStatusHealth = "healthy"
	ChannelStatusHealthWarning  ChannelStatusHealth = "warning"
	ChannelStatusHealthCritical ChannelStatusHealth = "critical"
)

type ChannelStatusItem struct {
	Group     string                    `json:"group"`
	ModelName string                    `json:"model_name"`
	Health    ChannelStatusHealth       `json:"health"`
	LatencyMs int64                     `json:"latency_ms"`
	Records   []model.ChannelTestRecord `json:"records"`
}

type ChannelStatusResult struct {
	Items []ChannelStatusItem `json:"items"`
}

func RecordChannelTestResult(channel *model.Channel, modelName string, latencyMs int64, success bool) {
	if channel == nil {
		return
	}
	if modelName == "" {
		modelName = channel.GetTestModel()
	}
	err := model.CreateChannelTestRecord(&model.ChannelTestRecord{
		ChannelId: channel.Id,
		ModelName: modelName,
		Success:   success,
		LatencyMs: latencyMs,
		TestedAt:  time.Now().UnixMilli(),
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
			records, err = model.GetLatestChannelTestRecords(target.ChannelId, model.ChannelTestHistoryLimit)
			if err != nil {
				return ChannelStatusResult{}, err
			}
			recordsByChannel[target.ChannelId] = records
		}

		item := ChannelStatusItem{
			Group:     target.Group,
			ModelName: target.ModelName,
			Health:    ChannelStatusHealthUnknown,
			Records:   make([]model.ChannelTestRecord, len(records)),
		}
		if len(records) > 0 {
			latest := records[0]
			item.ModelName = latest.ModelName
			item.LatencyMs = latest.LatencyMs
			item.Health = channelTestHealth(latest)
			for i := range records {
				item.Records[len(records)-1-i] = records[i]
			}
		}
		items = append(items, item)
	}
	return ChannelStatusResult{Items: items}, nil
}

func channelTestHealth(record model.ChannelTestRecord) ChannelStatusHealth {
	if !record.Success {
		return ChannelStatusHealthCritical
	}
	if record.LatencyMs <= 8000 {
		return ChannelStatusHealthHealthy
	}
	if record.LatencyMs <= 15000 {
		return ChannelStatusHealthWarning
	}
	return ChannelStatusHealthCritical
}
