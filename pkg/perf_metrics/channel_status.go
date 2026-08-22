package perfmetrics

import (
	"math"
	"sort"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
)

var channelHotBuckets sync.Map

func RecordChannelStatusSample(sample ChannelSample) {
	if !perf_metrics_setting.GetSetting().Enabled || sample.ChannelId <= 0 || sample.ChannelType <= 0 || sample.Model == "" {
		return
	}
	if sample.Group == "" {
		sample.Group = "default"
	}
	if sample.LatencyMs < 0 {
		sample.LatencyMs = 0
	}
	key := channelBucketKey{
		channelId:   sample.ChannelId,
		channelType: sample.ChannelType,
		model:       sample.Model,
		group:       sample.Group,
		bucketTs:    bucketStart(time.Now().Unix()),
	}
	actual, _ := channelHotBuckets.LoadOrStore(key, &atomicBucket{})
	bucket := actual.(*atomicBucket)
	bucket.add(sample.Sample)
	bucket.addLatestLatency(sample.Sample)
}

func QueryChannelStatus(hours int, groups []string) (ChannelStatusResult, error) {
	if hours <= 0 {
		hours = 24 * 7
	}
	if hours > 24*30 {
		hours = 24 * 30
	}
	bucketSeconds := channelStatusDisplayBucket(hours)
	endTs := time.Now().Unix()
	startTs := endTs - int64(hours)*3600
	modelDefaults, err := model.GetChannelStatusDefaults(groups)
	if err != nil {
		return ChannelStatusResult{}, err
	}

	merged := map[channelBucketKey]counters{}
	rows, err := model.GetChannelStatusMetricBuckets(startTs, endTs, bucketSeconds, groups)
	if err != nil {
		return ChannelStatusResult{}, err
	}
	for _, row := range rows {
		key := channelBucketKey{
			channelType: row.ChannelType,
			model:       row.ModelName,
			group:       row.Group,
			bucketTs:    row.BucketTs,
		}
		mergeChannelCounters(merged, key, countersFromChannelStatusRow(row))
	}
	latestRows, err := model.GetChannelStatusLatestLatencies(groups)
	if err != nil {
		return ChannelStatusResult{}, err
	}
	latestByDimension := make(map[channelStatusDimension]channelStatusLatestLatency, len(latestRows))
	for _, row := range latestRows {
		dimension := channelStatusDimension{channelType: row.ChannelType, group: row.Group, model: row.ModelName}
		if _, exists := latestByDimension[dimension]; exists {
			continue
		}
		latestByDimension[dimension] = channelStatusLatestLatency{latencyMs: row.LatestLatencyMs, ts: row.LatestLatencyTs}
	}

	allowedGroups := allowedGroupSet(groups)
	channelHotBuckets.Range(func(key, value any) bool {
		k := key.(channelBucketKey)
		snapshot := value.(*atomicBucket).snapshot()
		dimension := channelStatusDimension{channelType: k.channelType, group: k.group, model: k.model}
		latest := latestByDimension[dimension]
		if snapshot.latestLatencyTs > latest.ts {
			latestByDimension[dimension] = channelStatusLatestLatency{latencyMs: snapshot.latestLatencyMs, ts: snapshot.latestLatencyTs}
		}
		if k.bucketTs < startTs || k.bucketTs > endTs {
			return true
		}
		if allowedGroups != nil {
			if _, ok := allowedGroups[k.group]; !ok {
				return true
			}
		}
		k.channelId = 0
		k.bucketTs -= k.bucketTs % bucketSeconds
		mergeChannelCounters(merged, k, snapshot)
		return true
	})

	return buildChannelStatusResultWithDefaults(hours, bucketSeconds, startTs, merged, modelDefaults, latestByDimension), nil
}

func channelStatusDisplayBucket(hours int) int64 {
	switch {
	case hours <= 24:
		return 3600
	case hours <= 24*7:
		return 6 * 3600
	default:
		return 24 * 3600
	}
}

func countersFromChannelStatusRow(row model.ChannelStatusMetricBucket) counters {
	return counters{
		requestCount:   row.RequestCount,
		successCount:   row.SuccessCount,
		totalLatencyMs: row.TotalLatencyMs,
		ttftSumMs:      row.TtftSumMs,
		ttftCount:      row.TtftCount,
		outputTokens:   row.OutputTokens,
		generationMs:   row.GenerationMs,
	}
}

func mergeChannelCounters(merged map[channelBucketKey]counters, key channelBucketKey, value counters) {
	if value.requestCount == 0 {
		return
	}
	current := merged[key]
	current.requestCount += value.requestCount
	current.successCount += value.successCount
	current.totalLatencyMs += value.totalLatencyMs
	current.ttftSumMs += value.ttftSumMs
	current.ttftCount += value.ttftCount
	current.outputTokens += value.outputTokens
	current.generationMs += value.generationMs
	if value.latestLatencyTs > current.latestLatencyTs {
		current.latestLatencyMs = value.latestLatencyMs
		current.latestLatencyTs = value.latestLatencyTs
	}
	merged[key] = current
}

type channelStatusDimension struct {
	channelType int
	group       string
	model       string
}

type channelStatusAggregate struct {
	dimension channelStatusDimension
	total     counters
	buckets   map[int64]counters
}

type channelStatusLatestLatency struct {
	latencyMs int64
	ts        int64
}

func buildChannelStatusResultWithDefaults(hours int, bucketSeconds, startTs int64, merged map[channelBucketKey]counters, defaults []model.ChannelStatusDefault, latestByDimension map[channelStatusDimension]channelStatusLatestLatency) ChannelStatusResult {
	defaultByGroup := make(map[string]model.ChannelStatusDefault, len(defaults))
	for _, value := range defaults {
		defaultByGroup[value.Group] = value
	}
	dimensions := map[channelStatusDimension]*channelStatusAggregate{}
	overall := counters{}
	overallBuckets := map[int64]counters{}
	throughTs := int64(0)

	for key, value := range merged {
		dimension := channelStatusDimension{channelType: key.channelType, group: key.group, model: key.model}
		if len(defaultByGroup) > 0 {
			defaultValue, ok := defaultByGroup[key.group]
			if !ok || defaultValue.ModelName != key.model {
				continue
			}
			dimension = channelStatusDimension{channelType: defaultValue.ChannelType, group: defaultValue.Group, model: defaultValue.ModelName}
		}
		aggregate, ok := dimensions[dimension]
		if !ok {
			aggregate = &channelStatusAggregate{dimension: dimension, buckets: map[int64]counters{}}
			dimensions[dimension] = aggregate
		}
		addCounters(&aggregate.total, value)
		bucket := aggregate.buckets[key.bucketTs]
		addCounters(&bucket, value)
		aggregate.buckets[key.bucketTs] = bucket
		addCounters(&overall, value)
		overallBucket := overallBuckets[key.bucketTs]
		addCounters(&overallBucket, value)
		overallBuckets[key.bucketTs] = overallBucket
		if key.bucketTs > throughTs {
			throughTs = key.bucketTs
		}
	}
	for _, defaultValue := range defaultByGroup {
		key := channelStatusDimension{channelType: defaultValue.ChannelType, group: defaultValue.Group, model: defaultValue.ModelName}
		if _, ok := dimensions[key]; !ok {
			dimensions[key] = &channelStatusAggregate{dimension: key, buckets: map[int64]counters{}}
		}
	}
	for sourceDimension, latest := range latestByDimension {
		dimension := sourceDimension
		if len(defaultByGroup) > 0 {
			defaultValue, ok := defaultByGroup[sourceDimension.group]
			if !ok || defaultValue.ModelName != sourceDimension.model {
				continue
			}
			dimension = channelStatusDimension{channelType: defaultValue.ChannelType, group: defaultValue.Group, model: defaultValue.ModelName}
		}
		aggregate, ok := dimensions[dimension]
		if !ok {
			continue
		}
		if latest.ts > aggregate.total.latestLatencyTs {
			aggregate.total.latestLatencyMs = latest.latencyMs
			aggregate.total.latestLatencyTs = latest.ts
		}
		if latest.ts > overall.latestLatencyTs {
			overall.latestLatencyMs = latest.latencyMs
			overall.latestLatencyTs = latest.ts
		}
	}

	aggregates := make([]*channelStatusAggregate, 0, len(dimensions))
	for _, aggregate := range dimensions {
		aggregates = append(aggregates, aggregate)
	}
	sort.Slice(aggregates, func(i, j int) bool {
		if aggregates[i].total.requestCount == aggregates[j].total.requestCount {
			if aggregates[i].dimension.channelType == aggregates[j].dimension.channelType {
				if aggregates[i].dimension.group == aggregates[j].dimension.group {
					return aggregates[i].dimension.model < aggregates[j].dimension.model
				}
				return aggregates[i].dimension.group < aggregates[j].dimension.group
			}
			return aggregates[i].dimension.channelType < aggregates[j].dimension.channelType
		}
		return aggregates[i].total.requestCount > aggregates[j].total.requestCount
	})

	items := make([]ChannelStatusRow, 0, len(aggregates))
	for _, aggregate := range aggregates {
		defaultValue := defaultByGroup[aggregate.dimension.group]
		items = append(items, ChannelStatusRow{
			ChannelType: aggregate.dimension.channelType,
			Provider:    constant.GetChannelTypeName(aggregate.dimension.channelType),
			Group:       aggregate.dimension.group,
			ModelName:   aggregate.dimension.model,
			PingMs:      defaultValue.PingMs,
			Metrics:     channelStatusSummary(aggregate.total),
			Series:      channelStatusSeries(aggregate.buckets),
		})
	}

	return ChannelStatusResult{
		Hours:         hours,
		BucketSeconds: bucketSeconds,
		FromTs:        startTs,
		ThroughTs:     throughTs,
		Truncated:     false,
		Summary:       channelStatusSummary(overall),
		Series:        channelStatusSeries(overallBuckets),
		Items:         items,
	}
}

func addCounters(target *counters, value counters) {
	target.requestCount += value.requestCount
	target.successCount += value.successCount
	target.totalLatencyMs += value.totalLatencyMs
	target.ttftSumMs += value.ttftSumMs
	target.ttftCount += value.ttftCount
	target.outputTokens += value.outputTokens
	target.generationMs += value.generationMs
	if value.latestLatencyTs > target.latestLatencyTs {
		target.latestLatencyMs = value.latestLatencyMs
		target.latestLatencyTs = value.latestLatencyTs
	}
}

func channelStatusSummary(value counters) ChannelStatusSummary {
	hasData := value.requestCount > 0
	return ChannelStatusSummary{
		AvgTtftMs:       avg(value.ttftSumMs, value.ttftCount),
		AvgLatencyMs:    avg(value.totalLatencyMs, value.requestCount),
		LatestLatencyMs: value.latestLatencyMs,
		SuccessRate:     roundMetric(successRate(value)),
		AvgTps:          roundMetric(avgTps(value)),
		Health:          channelStatusHealth(value),
		HasData:         hasData,
	}
}

func channelStatusHealth(value counters) ChannelStatusHealth {
	if value.requestCount == 0 {
		return ChannelStatusHealthUnknown
	}
	rate := successRate(value)
	latency := value.latestLatencyMs
	if rate >= 99 && (latency == 0 || latency <= 8000) {
		return ChannelStatusHealthHealthy
	}
	if rate >= 95 && (latency == 0 || latency <= 15000) {
		return ChannelStatusHealthWarning
	}
	return ChannelStatusHealthCritical
}

func channelStatusSeries(buckets map[int64]counters) []ChannelStatusPoint {
	timestamps := make([]int64, 0, len(buckets))
	for timestamp := range buckets {
		timestamps = append(timestamps, timestamp)
	}
	sort.Slice(timestamps, func(i, j int) bool { return timestamps[i] < timestamps[j] })
	series := make([]ChannelStatusPoint, 0, len(timestamps))
	for _, timestamp := range timestamps {
		value := buckets[timestamp]
		series = append(series, ChannelStatusPoint{
			Ts:           timestamp,
			RequestCount: value.requestCount,
			SuccessCount: value.successCount,
			AvgTtftMs:    avg(value.ttftSumMs, value.ttftCount),
			AvgLatencyMs: avg(value.totalLatencyMs, value.requestCount),
			SuccessRate:  roundMetric(successRate(value)),
			AvgTps:       roundMetric(avgTps(value)),
			HasData:      value.requestCount > 0,
		})
	}
	return series
}

func roundMetric(value float64) float64 {
	return math.Round(value*100) / 100
}
