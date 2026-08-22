package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetChannelStatusDefaultsUsesFirstConfiguredModelAndPriority(t *testing.T) {
	truncateTables(t)
	lowPriority := int64(1)
	highPriority := int64(5)
	configuredModel := "configured-model"
	channels := []Channel{
		{Id: 1, Type: 1, Status: common.ChannelStatusEnabled, Models: "first-model,second-model", Group: "default", Priority: &lowPriority},
		{Id: 2, Type: 2, Status: common.ChannelStatusEnabled, Models: "other-model", Group: "default,vip", TestModel: &configuredModel, Priority: &highPriority, ResponseTime: 42},
	}
	require.NoError(t, DB.Create(&channels).Error)

	defaults, err := GetChannelStatusDefaults([]string{"default", "vip"})
	require.NoError(t, err)
	require.Len(t, defaults, 2)
	assert.Equal(t, ChannelStatusDefault{ChannelType: 2, Group: "default", ModelName: "other-model", PingMs: 42}, defaults[0])
	assert.Equal(t, ChannelStatusDefault{ChannelType: 2, Group: "vip", ModelName: "other-model", PingMs: 42}, defaults[1])
}

func TestUpsertChannelStatusMetricAccumulatesBucketCounters(t *testing.T) {
	truncateTables(t)
	first := &ChannelStatusMetric{
		ChannelId:       12,
		ChannelType:     1,
		ModelName:       "gpt-test",
		Group:           "default",
		BucketTs:        3600,
		RequestCount:    2,
		SuccessCount:    1,
		TotalLatencyMs:  1200,
		TtftSumMs:       300,
		TtftCount:       1,
		OutputTokens:    40,
		GenerationMs:    800,
		LatestLatencyMs: 600,
		LatestLatencyTs: 1000,
	}
	second := *first
	second.Id = 0
	second.RequestCount = 3
	second.SuccessCount = 3
	second.TotalLatencyMs = 1800
	second.TtftSumMs = 500
	second.TtftCount = 2
	second.OutputTokens = 60
	second.GenerationMs = 1200
	second.LatestLatencyMs = 450
	second.LatestLatencyTs = 2000
	older := second
	older.Id = 0
	older.RequestCount = 1
	older.SuccessCount = 1
	older.TotalLatencyMs = 900
	older.TtftSumMs = 250
	older.TtftCount = 1
	older.OutputTokens = 30
	older.GenerationMs = 600
	older.LatestLatencyMs = 900
	older.LatestLatencyTs = 1500

	require.NoError(t, UpsertChannelStatusMetric(first))
	require.NoError(t, UpsertChannelStatusMetric(&second))
	require.NoError(t, UpsertChannelStatusMetric(&older))

	var stored ChannelStatusMetric
	require.NoError(t, DB.First(&stored).Error)
	assert.Equal(t, int64(6), stored.RequestCount)
	assert.Equal(t, int64(5), stored.SuccessCount)
	assert.Equal(t, int64(3900), stored.TotalLatencyMs)
	assert.Equal(t, int64(1050), stored.TtftSumMs)
	assert.Equal(t, int64(4), stored.TtftCount)
	assert.Equal(t, int64(130), stored.OutputTokens)
	assert.Equal(t, int64(2600), stored.GenerationMs)
	assert.Equal(t, int64(450), stored.LatestLatencyMs)
	assert.Equal(t, int64(2000), stored.LatestLatencyTs)
}

func TestGetChannelStatusMetricBucketsAggregatesChannelsByDisplayBucket(t *testing.T) {
	truncateTables(t)
	metrics := []ChannelStatusMetric{
		{ChannelId: 1, ChannelType: 1, ModelName: "gpt-test", Group: "default", BucketTs: 3600, RequestCount: 2, SuccessCount: 2},
		{ChannelId: 2, ChannelType: 1, ModelName: "gpt-test", Group: "default", BucketTs: 7200, RequestCount: 3, SuccessCount: 2},
		{ChannelId: 3, ChannelType: 1, ModelName: "gpt-test", Group: "vip", BucketTs: 7200, RequestCount: 7, SuccessCount: 7},
	}
	require.NoError(t, DB.Create(&metrics).Error)

	rows, err := GetChannelStatusMetricBuckets(0, 21600, 21600, []string{"default"})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, "default", rows[0].Group)
	assert.Equal(t, int64(0), rows[0].BucketTs)
	assert.Equal(t, int64(5), rows[0].RequestCount)
	assert.Equal(t, int64(4), rows[0].SuccessCount)
}

func TestGetChannelStatusLatestLatenciesOrdersLatestCallsFirst(t *testing.T) {
	truncateTables(t)
	metrics := []ChannelStatusMetric{
		{ChannelId: 1, ChannelType: 1, ModelName: "gpt-test", Group: "default", BucketTs: 3600, RequestCount: 1, LatestLatencyMs: 800, LatestLatencyTs: 1000},
		{ChannelId: 2, ChannelType: 1, ModelName: "gpt-test", Group: "default", BucketTs: 7200, RequestCount: 1, LatestLatencyMs: 350, LatestLatencyTs: 2000},
		{ChannelId: 3, ChannelType: 1, ModelName: "gpt-test", Group: "vip", BucketTs: 7200, RequestCount: 1, LatestLatencyMs: 500, LatestLatencyTs: 3000},
	}
	require.NoError(t, DB.Create(&metrics).Error)

	rows, err := GetChannelStatusLatestLatencies([]string{"default"})
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, int64(2000), rows[0].LatestLatencyTs)
	assert.Equal(t, int64(350), rows[0].LatestLatencyMs)
}
