package service

import (
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/console_setting"
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
	originalNotices := console_setting.GetConsoleSetting().ChannelStatusNotices
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
		console_setting.GetConsoleSetting().ChannelStatusNotices = originalNotices
	})
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1.5}`))
	console_setting.GetConsoleSetting().ChannelStatusNotices = `[
		{"channel_type":1,"level":"warning","content":"Maintenance window","enabled":true},
		{"channel_type":2,"level":"error","content":"Hidden notice","enabled":false}
	]`
	testModel := "configured-model"
	require.NoError(t, model.DB.Create(&[]model.Channel{
		{Id: 1, Type: 1, Name: "first", Status: common.ChannelStatusEnabled, Group: "default", Models: "fallback-model,alternate-model", TestModel: &testModel},
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
	assert.Equal(t, []string{"fallback-model", "alternate-model"}, result.Items[0].Models)
	assert.Equal(t, ChannelStatusHealthHealthy, result.Items[0].Health)
	assert.Equal(t, int64(500), result.Items[0].LatencyMs)
	assert.Equal(t, 100.0, result.Items[0].RecentSuccessRate)
	require.Len(t, result.Items[0].Records, 1)
	assert.Equal(t, testModel, result.Items[0].Records[0].ModelName)
	assert.Equal(t, 2, result.Items[1].ChannelId)
	assert.Equal(t, map[string]float64{"vip": 1.5}, result.Items[1].GroupRatios)
	assert.Equal(t, []string{"second-model"}, result.Items[1].Models)
	assert.Equal(t, ChannelStatusHealthUnknown, result.Items[1].Health)
	assert.Empty(t, result.Items[1].Records)
	require.Len(t, result.Notices, 1)
	assert.Equal(t, 1, result.Notices[0].ChannelType)
	assert.Equal(t, "warning", result.Notices[0].Level)
	assert.Equal(t, "Maintenance window", result.Notices[0].Content)
}

func TestValidateChannelStatusNotices(t *testing.T) {
	require.NoError(t, console_setting.ValidateConsoleSettings(
		`[{"channel_type":1,"level":"normal","content":"Operational","enabled":true}]`,
		"ChannelStatusNotices",
	))

	tests := []struct {
		name  string
		value string
	}{
		{name: "unknown platform", value: `[{"channel_type":999,"level":"normal","content":"Operational","enabled":true}]`},
		{name: "duplicate platform", value: `[{"channel_type":1,"level":"normal","content":"First","enabled":true},{"channel_type":1,"level":"error","content":"Second","enabled":true}]`},
		{name: "invalid level", value: `[{"channel_type":1,"level":"success","content":"Operational","enabled":true}]`},
		{name: "blank content", value: `[{"channel_type":1,"level":"normal","content":"   ","enabled":true}]`},
		{name: "content too long", value: `[{"channel_type":1,"level":"normal","content":"` + strings.Repeat("x", 201) + `","enabled":true}]`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Error(t, console_setting.ValidateConsoleSettings(tt.value, "ChannelStatusNotices"))
		})
	}
}
