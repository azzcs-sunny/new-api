package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelTestHealthUsesLatestResultAndLatency(t *testing.T) {
	tests := []struct {
		name     string
		record   model.ChannelTestRecord
		expected ChannelStatusHealth
	}{
		{name: "fast success", record: model.ChannelTestRecord{Success: true, LatencyMs: 5999}, expected: ChannelStatusHealthHealthy},
		{name: "slow success", record: model.ChannelTestRecord{Success: true, LatencyMs: 6000}, expected: ChannelStatusHealthWarning},
		{name: "very slow success", record: model.ChannelTestRecord{Success: true, LatencyMs: 74021}, expected: ChannelStatusHealthWarning},
		{name: "fast failure", record: model.ChannelTestRecord{Success: false, LatencyMs: 100}, expected: ChannelStatusHealthCritical},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, channelTestHealth(tt.record))
		})
	}
}

func TestQueryAllChannelStatusReturnsOneItemPerChannelUsingScheduledHistory(t *testing.T) {
	truncate(t)
	originalRatios := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	})
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1.5}`))
	testModel := "configured-model"
	require.NoError(t, model.DB.Create(&[]model.Channel{
		{Id: 1, Type: 1, Name: "first", Status: common.ChannelStatusEnabled, Group: "default", Models: "fallback-model", TestModel: &testModel},
		{Id: 2, Type: 2, Name: "second", Status: common.ChannelStatusManuallyDisabled, Group: "vip", Models: "second-model"},
	}).Error)
	require.NoError(t, model.CreateChannelTestRecord(&model.ChannelTestRecord{
		ChannelId:   1,
		TriggerType: model.ChannelTestTriggerManual,
		ModelName:   "manual-model",
		Success:     false,
		LatencyMs:   99,
		TestedAt:    300,
	}))
	require.NoError(t, model.CreateChannelTestRecord(&model.ChannelTestRecord{
		ChannelId:   1,
		TriggerType: model.ChannelTestTriggerScheduled,
		ModelName:   testModel,
		Success:     true,
		LatencyMs:   500,
		TestedAt:    time.Now().UnixMilli(),
	}))

	result, err := QueryAllChannelStatus()
	require.NoError(t, err)
	require.Len(t, result.Items, 2)
	assert.Equal(t, 1, result.Items[0].ChannelId)
	assert.Equal(t, "first", result.Items[0].ChannelName)
	assert.Equal(t, map[string]float64{"default": 1}, result.Items[0].GroupRatios)
	assert.Equal(t, ChannelStatusHealthHealthy, result.Items[0].Health)
	assert.Equal(t, int64(500), result.Items[0].LatencyMs)
	assert.Equal(t, 100.0, result.Items[0].RecentSuccessRate)
	require.Len(t, result.Items[0].Records, 1)
	assert.Equal(t, testModel, result.Items[0].Records[0].ModelName)
	assert.Equal(t, 2, result.Items[1].ChannelId)
	assert.Equal(t, map[string]float64{"vip": 1.5}, result.Items[1].GroupRatios)
	assert.Equal(t, ChannelStatusHealthUnknown, result.Items[1].Health)
	assert.Empty(t, result.Items[1].Records)
}
