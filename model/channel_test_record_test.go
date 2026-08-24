package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetChannelStatusTargetsUsesTestModelAndPriority(t *testing.T) {
	truncateTables(t)
	lowPriority := int64(1)
	highPriority := int64(5)
	configuredModel := "configured-model"
	channels := []Channel{
		{Id: 1, Type: 1, Status: common.ChannelStatusEnabled, Models: "first-model,second-model", Group: "default", Priority: &lowPriority},
		{Id: 2, Type: 2, Status: common.ChannelStatusEnabled, Models: "other-model", Group: "default,vip", TestModel: &configuredModel, Priority: &highPriority},
	}
	require.NoError(t, DB.Create(&channels).Error)

	targets, err := GetChannelStatusTargets([]string{"default", "vip"})
	require.NoError(t, err)
	require.Len(t, targets, 2)
	assert.Equal(t, ChannelStatusTarget{ChannelId: 2, Group: "default", ModelName: configuredModel}, targets[0])
	assert.Equal(t, ChannelStatusTarget{ChannelId: 2, Group: "vip", ModelName: configuredModel}, targets[1])
}

func TestCreateChannelTestRecordKeepsLatestSixtyPerChannel(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&[]Channel{{Id: 1}, {Id: 2}}).Error)
	for i := 1; i <= ChannelTestHistoryLimit+2; i++ {
		require.NoError(t, CreateChannelTestRecord(&ChannelTestRecord{
			ChannelId: 1,
			ModelName: fmt.Sprintf("model-%d", i),
			Success:   i%2 == 0,
			LatencyMs: int64(i * 10),
			TestedAt:  int64(i),
		}))
	}
	require.NoError(t, CreateChannelTestRecord(&ChannelTestRecord{
		ChannelId: 2,
		ModelName: "other-channel",
		Success:   true,
		LatencyMs: 25,
		TestedAt:  1,
	}))

	records, err := GetLatestChannelTestRecords(1, ChannelTestTriggerScheduled, ChannelTestHistoryLimit)
	require.NoError(t, err)
	require.Len(t, records, ChannelTestHistoryLimit)
	assert.Equal(t, "model-62", records[0].ModelName)
	assert.Equal(t, "model-3", records[len(records)-1].ModelName)

	otherRecords, err := GetLatestChannelTestRecords(2, ChannelTestTriggerScheduled, ChannelTestHistoryLimit)
	require.NoError(t, err)
	require.Len(t, otherRecords, 1)
	assert.Equal(t, "other-channel", otherRecords[0].ModelName)
}

func TestCreateChannelTestRecordKeepsSeparateScheduledAndManualHistory(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&Channel{Id: 1}).Error)

	for i := 1; i <= ChannelTestHistoryLimit+1; i++ {
		require.NoError(t, CreateChannelTestRecord(&ChannelTestRecord{
			ChannelId:   1,
			TriggerType: ChannelTestTriggerManual,
			ModelName:   "manual-model",
			Success:     true,
			TestedAt:    int64(i),
		}))
	}
	require.NoError(t, CreateChannelTestRecord(&ChannelTestRecord{
		ChannelId:   1,
		TriggerType: ChannelTestTriggerScheduled,
		ModelName:   "scheduled-model",
		Success:     true,
		TestedAt:    1,
	}))

	manual, err := GetLatestChannelTestRecords(1, ChannelTestTriggerManual, ChannelTestHistoryLimit)
	require.NoError(t, err)
	require.Len(t, manual, ChannelTestHistoryLimit)
	scheduled, err := GetLatestChannelTestRecords(1, ChannelTestTriggerScheduled, ChannelTestHistoryLimit)
	require.NoError(t, err)
	require.Len(t, scheduled, 1)
	assert.Equal(t, "scheduled-model", scheduled[0].ModelName)
}
