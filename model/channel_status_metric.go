package model

import (
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ChannelStatusDefault describes the model used to represent one channel group.
type ChannelStatusDefault struct {
	ChannelType int
	Group       string
	ModelName   string
	PingMs      int
}

// GetChannelStatusDefaults returns one stable default model for every enabled group.
// The first model in a channel's models list is the default; test_model is only a fallback.
func GetChannelStatusDefaults(groups []string) ([]ChannelStatusDefault, error) {
	allowed := make(map[string]struct{}, len(groups))
	for _, group := range groups {
		group = strings.TrimSpace(group)
		if group != "" {
			allowed[group] = struct{}{}
		}
	}

	var channels []Channel
	if err := DB.Select("id", "type", "test_model", "models", commonGroupCol, "priority", "response_time").
		Where("status = ?", common.ChannelStatusEnabled).
		Find(&channels).Error; err != nil {
		return nil, err
	}

	type candidate struct {
		defaultValue ChannelStatusDefault
		priority     int64
		channelID    int
	}
	selected := make(map[string]candidate)
	for _, channel := range channels {
		modelName := ""
		models := channel.GetModels()
		if len(models) > 0 {
			modelName = strings.TrimSpace(models[0])
		}
		if modelName == "" && channel.TestModel != nil {
			modelName = strings.TrimSpace(*channel.TestModel)
		}
		if modelName == "" {
			modelName = "gpt-4o-mini"
		}
		for _, group := range channel.GetGroups() {
			if len(allowed) > 0 {
				if _, ok := allowed[group]; !ok {
					continue
				}
			}
			current, exists := selected[group]
			priority := channel.GetPriority()
			if exists && (priority < current.priority || (priority == current.priority && channel.Id > current.channelID)) {
				continue
			}
			selected[group] = candidate{
				defaultValue: ChannelStatusDefault{
					ChannelType: channel.Type,
					Group:       group,
					ModelName:   modelName,
					PingMs:      channel.ResponseTime,
				},
				priority:  priority,
				channelID: channel.Id,
			}
		}
	}

	defaults := make([]ChannelStatusDefault, 0, len(selected))
	for _, value := range selected {
		defaults = append(defaults, value.defaultValue)
	}
	sort.Slice(defaults, func(i, j int) bool {
		if defaults[i].Group == defaults[j].Group {
			return defaults[i].ChannelType < defaults[j].ChannelType
		}
		return defaults[i].Group < defaults[j].Group
	})
	return defaults, nil
}

// ChannelStatusMetric stores passive relay health metrics by upstream channel.
type ChannelStatusMetric struct {
	Id              int    `json:"id" gorm:"primaryKey"`
	ChannelId       int    `json:"-" gorm:"uniqueIndex:idx_channel_status_metric_bucket,priority:1"`
	ChannelType     int    `json:"channel_type" gorm:"uniqueIndex:idx_channel_status_metric_bucket,priority:2"`
	ModelName       string `json:"model_name" gorm:"size:128;uniqueIndex:idx_channel_status_metric_bucket,priority:3"`
	Group           string `json:"group" gorm:"column:group;size:64;uniqueIndex:idx_channel_status_metric_bucket,priority:4"`
	BucketTs        int64  `json:"bucket_ts" gorm:"uniqueIndex:idx_channel_status_metric_bucket,priority:5;index:idx_channel_status_bucket_ts"`
	RequestCount    int64  `json:"-" gorm:"default:0"`
	SuccessCount    int64  `json:"-" gorm:"default:0"`
	TotalLatencyMs  int64  `json:"-" gorm:"default:0"`
	TtftSumMs       int64  `json:"-" gorm:"default:0"`
	TtftCount       int64  `json:"-" gorm:"default:0"`
	OutputTokens    int64  `json:"-" gorm:"default:0"`
	GenerationMs    int64  `json:"-" gorm:"default:0"`
	LatestLatencyMs int64  `json:"-" gorm:"default:0"`
	LatestLatencyTs int64  `json:"-" gorm:"default:0"`
}

func (ChannelStatusMetric) TableName() string {
	return "channel_status_metrics"
}

func UpsertChannelStatusMetric(metric *ChannelStatusMetric) error {
	if metric == nil || metric.RequestCount == 0 {
		return nil
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "channel_id"},
			{Name: "channel_type"},
			{Name: "model_name"},
			{Name: "group"},
			{Name: "bucket_ts"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"request_count":     gorm.Expr("channel_status_metrics.request_count + ?", metric.RequestCount),
			"success_count":     gorm.Expr("channel_status_metrics.success_count + ?", metric.SuccessCount),
			"total_latency_ms":  gorm.Expr("channel_status_metrics.total_latency_ms + ?", metric.TotalLatencyMs),
			"ttft_sum_ms":       gorm.Expr("channel_status_metrics.ttft_sum_ms + ?", metric.TtftSumMs),
			"ttft_count":        gorm.Expr("channel_status_metrics.ttft_count + ?", metric.TtftCount),
			"output_tokens":     gorm.Expr("channel_status_metrics.output_tokens + ?", metric.OutputTokens),
			"generation_ms":     gorm.Expr("channel_status_metrics.generation_ms + ?", metric.GenerationMs),
			"latest_latency_ms": gorm.Expr("CASE WHEN channel_status_metrics.latest_latency_ts < ? THEN ? ELSE channel_status_metrics.latest_latency_ms END", metric.LatestLatencyTs, metric.LatestLatencyMs),
			"latest_latency_ts": gorm.Expr("CASE WHEN channel_status_metrics.latest_latency_ts < ? THEN ? ELSE channel_status_metrics.latest_latency_ts END", metric.LatestLatencyTs, metric.LatestLatencyTs),
		}),
	}).Create(metric).Error
}

type ChannelStatusMetricBucket struct {
	ChannelType    int
	ModelName      string
	Group          string
	BucketTs       int64
	RequestCount   int64
	SuccessCount   int64
	TotalLatencyMs int64
	TtftSumMs      int64
	TtftCount      int64
	OutputTokens   int64
	GenerationMs   int64
}

type ChannelStatusLatestLatency struct {
	ChannelType     int
	ModelName       string
	Group           string
	LatestLatencyMs int64
	LatestLatencyTs int64
}

func GetChannelStatusLatestLatencies(groups []string) ([]ChannelStatusLatestLatency, error) {
	var rows []ChannelStatusLatestLatency
	query := DB.Model(&ChannelStatusMetric{}).
		Select("channel_type, model_name, " + commonGroupCol + ", latest_latency_ms, latest_latency_ts").
		Where("latest_latency_ts > 0")
	if groups != nil {
		if len(groups) == 0 {
			return rows, nil
		}
		query = query.Where(commonGroupCol+" IN ?", groups)
	}
	err := query.Order("latest_latency_ts DESC").Find(&rows).Error
	return rows, err
}

func GetChannelStatusMetricBuckets(startTs, endTs, bucketSeconds int64, groups []string) ([]ChannelStatusMetricBucket, error) {
	var rows []ChannelStatusMetricBucket
	if bucketSeconds <= 0 {
		bucketSeconds = 3600
	}
	bucketExpr := fmt.Sprintf("bucket_ts - (bucket_ts %% %d)", bucketSeconds)
	query := DB.Model(&ChannelStatusMetric{}).
		Select("channel_type, model_name, "+commonGroupCol+", "+bucketExpr+" AS bucket_ts, "+
			"SUM(request_count) AS request_count, SUM(success_count) AS success_count, "+
			"SUM(total_latency_ms) AS total_latency_ms, SUM(ttft_sum_ms) AS ttft_sum_ms, "+
			"SUM(ttft_count) AS ttft_count, SUM(output_tokens) AS output_tokens, "+
			"SUM(generation_ms) AS generation_ms").
		Where("bucket_ts >= ? AND bucket_ts <= ?", startTs, endTs)
	if groups != nil {
		if len(groups) == 0 {
			return rows, nil
		}
		query = query.Where(commonGroupCol+" IN ?", groups)
	}
	err := query.
		Group("channel_type, model_name, " + commonGroupCol + ", " + bucketExpr).
		Order("bucket_ts ASC").
		Find(&rows).Error
	return rows, err
}

func DeleteChannelStatusMetricsBefore(cutoffTs int64) error {
	if cutoffTs <= 0 {
		return nil
	}
	return DB.Where("bucket_ts < ?", cutoffTs).Delete(&ChannelStatusMetric{}).Error
}
