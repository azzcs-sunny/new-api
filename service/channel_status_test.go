package service

import (
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelTestHealthUsesLatestResultAndLatency(t *testing.T) {
	originalThreshold := operation_setting.GetMonitorSetting().ChannelStatusHealthySeconds
	t.Cleanup(func() {
		require.NoError(t, config.UpdateConfigFromMap(operation_setting.GetMonitorSetting(), map[string]string{
			"channel_status_healthy_seconds": strconv.Itoa(originalThreshold),
		}))
	})
	require.NoError(t, config.UpdateConfigFromMap(operation_setting.GetMonitorSetting(), map[string]string{
		"channel_status_healthy_seconds": "12",
	}))
	tests := []struct {
		name     string
		record   model.ChannelTestRecord
		expected ChannelStatusHealth
	}{
		{name: "fast success", record: model.ChannelTestRecord{Success: true, LatencyMs: 11999}, expected: ChannelStatusHealthHealthy},
		{name: "slow success", record: model.ChannelTestRecord{Success: true, LatencyMs: 12000}, expected: ChannelStatusHealthWarning},
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
	monitorSetting := operation_setting.GetMonitorSetting()
	originalDisabledChannelIds := append([]int(nil), monitorSetting.ChannelTestDisabledChannelIds...)
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
		console_setting.GetConsoleSetting().ChannelStatusNotices = originalNotices
		monitorSetting.ChannelTestDisabledChannelIds = originalDisabledChannelIds
	})
	monitorSetting.ChannelTestDisabledChannelIds = []int{2}
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
	assert.True(t, result.Items[0].Visible)
	assert.True(t, result.Items[1].Visible)
	require.NotNil(t, result.Items[0].ActiveTestEnabled)
	require.NotNil(t, result.Items[1].ActiveTestEnabled)
	assert.True(t, *result.Items[0].ActiveTestEnabled)
	assert.False(t, *result.Items[1].ActiveTestEnabled)
	assert.Equal(t, int64(12000), result.DegradedLatencyMs)
}

func TestQueryAllChannelStatusIgnoresRecordsFromBeforeChannelCreation(t *testing.T) {
	truncate(t)
	createdAt := time.Now().Add(-time.Minute).Unix()
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:          7,
		Name:        "reused-id",
		Status:      common.ChannelStatusEnabled,
		Group:       "default",
		Models:      "current-model",
		CreatedTime: createdAt,
	}).Error)
	require.NoError(t, model.DB.Create(&[]model.ChannelTestRecord{
		{
			ChannelId:   7,
			TriggerType: model.ChannelTestTriggerScheduled,
			ModelName:   "previous-channel-model",
			Success:     false,
			LatencyMs:   90000,
			TestedAt:    time.Unix(createdAt-1, 0).UnixMilli(),
		},
		{
			ChannelId:   7,
			TriggerType: model.ChannelTestTriggerScheduled,
			ModelName:   "current-model",
			Success:     true,
			LatencyMs:   500,
			TestedAt:    time.Unix(createdAt+1, 0).UnixMilli(),
		},
	}).Error)

	result, err := QueryAllChannelStatus()
	require.NoError(t, err)
	require.Len(t, result.Items, 1)
	require.Len(t, result.Items[0].Records, 1)
	assert.Equal(t, "current-model", result.Items[0].Records[0].ModelName)
	assert.Equal(t, ChannelStatusHealthHealthy, result.Items[0].Health)
	assert.Equal(t, 100.0, result.Items[0].RecentSuccessRate)
	assert.Equal(t, int64(1), result.Items[0].Availability7dN)
	assert.Equal(t, 100.0, result.Items[0].Availability7d)
}

func TestClearChannelStatusTestRecordsOnlyDeletesScheduledHistory(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.Create(&[]model.Channel{{Id: 1}, {Id: 2}}).Error)
	require.NoError(t, model.DB.Create(&[]model.ChannelTestRecord{
		{ChannelId: 1, TriggerType: model.ChannelTestTriggerScheduled, ModelName: "scheduled-1", TestedAt: 1},
		{ChannelId: 1, TriggerType: model.ChannelTestTriggerScheduled, ModelName: "scheduled-2", TestedAt: 2},
		{ChannelId: 1, TriggerType: model.ChannelTestTriggerManual, ModelName: "manual", TestedAt: 3},
		{ChannelId: 2, TriggerType: model.ChannelTestTriggerScheduled, ModelName: "other-channel", TestedAt: 4},
	}).Error)

	deleted, err := ClearChannelStatusTestRecords(1)
	require.NoError(t, err)
	assert.Equal(t, int64(2), deleted)

	var remaining []model.ChannelTestRecord
	require.NoError(t, model.DB.Order("id ASC").Find(&remaining).Error)
	require.Len(t, remaining, 2)
	assert.Equal(t, model.ChannelTestTriggerManual, remaining[0].TriggerType)
	assert.Equal(t, 1, remaining[0].ChannelId)
	assert.Equal(t, 2, remaining[1].ChannelId)

	_, err = ClearChannelStatusTestRecords(999)
	require.Error(t, err)
}

func TestQueryChannelStatusReturnsVisibleEnabledChannelsAndDynamicThreshold(t *testing.T) {
	truncate(t)
	original := *operation_setting.GetMonitorSetting()
	originalHiddenChannelIds, err := common.Marshal(original.ChannelStatusHiddenChannelIds)
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, config.UpdateConfigFromMap(operation_setting.GetMonitorSetting(), map[string]string{
			"channel_status_healthy_seconds":    strconv.Itoa(original.ChannelStatusHealthySeconds),
			"channel_status_hidden_channel_ids": string(originalHiddenChannelIds),
		}))
	})
	require.NoError(t, config.UpdateConfigFromMap(operation_setting.GetMonitorSetting(), map[string]string{
		"channel_status_healthy_seconds":    "20",
		"channel_status_hidden_channel_ids": "[2]",
	}))
	imageModel := "gpt-image-2"
	require.NoError(t, model.DB.Create(&[]model.Channel{
		{Id: 1, Type: 1, Name: "visible", Status: common.ChannelStatusEnabled, Group: "default", Models: "gpt-4o"},
		{Id: 2, Type: 1, Name: "hidden", Status: common.ChannelStatusEnabled, Group: "default", Models: "gpt-4o"},
		{Id: 3, Type: 1, Name: "disabled", Status: common.ChannelStatusManuallyDisabled, Group: "default", Models: "gpt-4o"},
		{Id: 4, Type: 1, Name: "media", Status: common.ChannelStatusEnabled, Group: "default", Models: "gpt-4o", TestModel: &imageModel},
		{Id: 5, Type: 1, Name: "hidden-group", Status: common.ChannelStatusEnabled, Group: "video", Models: "gpt-4o"},
	}).Error)

	result, err := QueryChannelStatus([]string{"default", "video"})
	require.NoError(t, err)
	require.Len(t, result.Items, 1)
	assert.Equal(t, "visible", result.Items[0].ChannelName)
	assert.True(t, result.Items[0].Visible)
	assert.Nil(t, result.Items[0].ActiveTestEnabled)
	assert.Equal(t, int64(20000), result.DegradedLatencyMs)
	encoded, err := common.Marshal(result)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "active_test_enabled")
}

func TestUpdateChannelActiveTestEnabledPersistsSelection(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Option{}))
	common.OptionMapRWMutex.Lock()
	originalOptionMap := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	monitorSetting := operation_setting.GetMonitorSetting()
	originalDisabledChannelIds := append([]int(nil), monitorSetting.ChannelTestDisabledChannelIds...)
	t.Cleanup(func() {
		monitorSetting.ChannelTestDisabledChannelIds = originalDisabledChannelIds
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()
		model.DB.Where("key = ?", operation_setting.ChannelTestDisabledChannelIdsOptionKey).Delete(&model.Option{})
	})
	monitorSetting.ChannelTestDisabledChannelIds = nil
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:     11,
		Name:   "selective-check",
		Status: common.ChannelStatusEnabled,
	}).Error)

	require.NoError(t, UpdateChannelActiveTestEnabled(11, false))
	assert.False(t, operation_setting.IsChannelActiveTestEnabled(11))
	var option model.Option
	require.NoError(t, model.DB.First(&option, "key = ?", operation_setting.ChannelTestDisabledChannelIdsOptionKey).Error)
	assert.Equal(t, "[11]", option.Value)

	require.NoError(t, UpdateChannelActiveTestEnabled(11, true))
	assert.True(t, operation_setting.IsChannelActiveTestEnabled(11))
	require.NoError(t, model.DB.First(&option, "key = ?", operation_setting.ChannelTestDisabledChannelIdsOptionKey).Error)
	assert.Equal(t, "[]", option.Value)
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
