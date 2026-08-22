package perfmetrics

import (
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRecordRelaySampleExcludesActiveChannelTests(t *testing.T) {
	hotBuckets = sync.Map{}
	channelHotBuckets = sync.Map{}
	t.Cleanup(func() {
		hotBuckets = sync.Map{}
		channelHotBuckets = sync.Map{}
	})
	info := &relaycommon.RelayInfo{
		StartTime:       time.Now().Add(-time.Second),
		OriginModelName: "gpt-test",
		UsingGroup:      "default",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 12, ChannelType: 1},
		IsChannelTest:   true,
	}

	RecordRelaySample(info, true, 10)

	channelSamples := 0
	channelHotBuckets.Range(func(_, _ any) bool {
		channelSamples++
		return true
	})
	assert.Zero(t, channelSamples)
}

func TestRecordRelaySampleAddsCompletedRelayToPassiveStatus(t *testing.T) {
	hotBuckets = sync.Map{}
	channelHotBuckets = sync.Map{}
	t.Cleanup(func() {
		hotBuckets = sync.Map{}
		channelHotBuckets = sync.Map{}
	})
	info := &relaycommon.RelayInfo{
		StartTime:       time.Now().Add(-time.Second),
		OriginModelName: "gpt-test",
		UsingGroup:      "default",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 12, ChannelType: 1},
	}

	RecordRelaySample(info, true, 10)

	channelSamples := int64(0)
	channelHotBuckets.Range(func(_, value any) bool {
		channelSamples += value.(*atomicBucket).snapshot().requestCount
		return true
	})
	assert.Equal(t, int64(1), channelSamples)
}

func TestChannelStatusHealthUsesSuccessAndLatencyThresholds(t *testing.T) {
	tests := []struct {
		name     string
		counters counters
		expected ChannelStatusHealth
	}{
		{name: "no samples", expected: ChannelStatusHealthUnknown},
		{name: "healthy", counters: counters{requestCount: 100, successCount: 99, latestLatencyMs: 8000}, expected: ChannelStatusHealthHealthy},
		{name: "latest slow request warns", counters: counters{requestCount: 100, successCount: 100, latestLatencyMs: 9000}, expected: ChannelStatusHealthWarning},
		{name: "warning", counters: counters{requestCount: 100, successCount: 95, latestLatencyMs: 15000}, expected: ChannelStatusHealthWarning},
		{name: "failure rate critical", counters: counters{requestCount: 100, successCount: 94, latestLatencyMs: 1000}, expected: ChannelStatusHealthCritical},
		{name: "latest latency critical", counters: counters{requestCount: 100, successCount: 100, latestLatencyMs: 15001}, expected: ChannelStatusHealthCritical},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, channelStatusHealth(tt.counters))
		})
	}
}

func TestBuildChannelStatusResultWeightsSummaryAndOrdersSeries(t *testing.T) {
	merged := map[channelBucketKey]counters{
		{channelType: 1, group: "default", model: "gpt-test", bucketTs: 7200}: {
			requestCount: 3, successCount: 2, totalLatencyMs: 900, ttftSumMs: 200, ttftCount: 2,
		},
		{channelType: 1, group: "default", model: "gpt-test", bucketTs: 3600}: {
			requestCount: 1, successCount: 1, totalLatencyMs: 100, ttftSumMs: 50, ttftCount: 1,
		},
	}

	latest := map[channelStatusDimension]channelStatusLatestLatency{
		{channelType: 1, group: "default", model: "gpt-test"}: {latencyMs: 175, ts: 9000},
	}
	result := buildChannelStatusResultWithDefaults(24, 3600, 0, merged, nil, latest)

	assert.Equal(t, 75.0, result.Summary.SuccessRate)
	assert.Equal(t, int64(250), result.Summary.AvgLatencyMs)
	assert.Equal(t, int64(83), result.Summary.AvgTtftMs)
	assert.Equal(t, int64(175), result.Summary.LatestLatencyMs)
	require.Len(t, result.Items, 1)
	require.Len(t, result.Series, 2)
	assert.Equal(t, int64(3600), result.Series[0].Ts)
	assert.Equal(t, int64(1), result.Series[0].RequestCount)
	assert.Equal(t, int64(1), result.Series[0].SuccessCount)
	assert.Equal(t, int64(7200), result.Series[1].Ts)
	assert.Equal(t, int64(3), result.Series[1].RequestCount)
	assert.Equal(t, int64(2), result.Series[1].SuccessCount)
	assert.Equal(t, ChannelStatusHealthCritical, result.Items[0].Metrics.Health)
}

func TestBuildChannelStatusResultWithDefaultsKeepsOneCardPerGroup(t *testing.T) {
	merged := map[channelBucketKey]counters{
		{channelType: 1, group: "default", model: "default-model", bucketTs: 3600}: {
			requestCount: 2, successCount: 2, totalLatencyMs: 200,
		},
		{channelType: 1, group: "default", model: "other-model", bucketTs: 3600}: {
			requestCount: 20, successCount: 20, totalLatencyMs: 2000,
		},
	}

	result := buildChannelStatusResultWithDefaults(24, 3600, 0, merged, []model.ChannelStatusDefault{
		{ChannelType: 1, Group: "default", ModelName: "default-model", PingMs: 37},
	}, map[channelStatusDimension]channelStatusLatestLatency{
		{channelType: 1, group: "default", model: "default-model"}: {latencyMs: 85, ts: 9000},
	})

	require.Len(t, result.Items, 1)
	assert.Equal(t, "default-model", result.Items[0].ModelName)
	assert.Equal(t, 100.0, result.Items[0].Metrics.SuccessRate)
	assert.Equal(t, int64(100), result.Items[0].Metrics.AvgLatencyMs)
	assert.Equal(t, int64(85), result.Items[0].Metrics.LatestLatencyMs)
	assert.Equal(t, 37, result.Items[0].PingMs)
}
