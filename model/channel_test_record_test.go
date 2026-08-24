package model

import (
	"fmt"
	"testing"
	"time"

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

func TestGetLatestChannelTestRecordsReturnsLatestSixtyWhileHistoryExceedsDisplayLimit(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&[]Channel{{Id: 1}, {Id: 2}}).Error)
	baseTestedAt := time.Now().UnixMilli()
	for i := 1; i <= ChannelTestHistoryLimit+2; i++ {
		require.NoError(t, CreateChannelTestRecord(&ChannelTestRecord{
			ChannelId: 1,
			ModelName: fmt.Sprintf("model-%d", i),
			Success:   i%2 == 0,
			LatencyMs: int64(i * 10),
			TestedAt:  baseTestedAt + int64(i),
		}))
	}
	require.NoError(t, CreateChannelTestRecord(&ChannelTestRecord{
		ChannelId: 2,
		ModelName: "other-channel",
		Success:   true,
		LatencyMs: 25,
		TestedAt:  baseTestedAt,
	}))

	records, err := GetLatestChannelTestRecords(1, ChannelTestTriggerScheduled, ChannelTestHistoryLimit)
	require.NoError(t, err)
	require.Len(t, records, ChannelTestHistoryLimit)
	assert.Equal(t, "model-62", records[0].ModelName)
	assert.Equal(t, "model-3", records[len(records)-1].ModelName)
	var total int64
	require.NoError(t, DB.Model(&ChannelTestRecord{}).Where("channel_id = ?", 1).Count(&total).Error)
	assert.Equal(t, int64(ChannelTestHistoryLimit+2), total)

	otherRecords, err := GetLatestChannelTestRecords(2, ChannelTestTriggerScheduled, ChannelTestHistoryLimit)
	require.NoError(t, err)
	require.Len(t, otherRecords, 1)
	assert.Equal(t, "other-channel", otherRecords[0].ModelName)
}

func TestGetChannelTestAvailabilityStatsUsesTimeWindows(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&Channel{Id: 1}).Error)
	now := time.UnixMilli(30 * 24 * 60 * 60 * 1000)
	addRecord := func(daysAgo int, success bool, latency int64) {
		require.NoError(t, DB.Create(&ChannelTestRecord{
			ChannelId:   1,
			TriggerType: ChannelTestTriggerScheduled,
			ModelName:   "model",
			Success:     success,
			LatencyMs:   latency,
			TestedAt:    now.Add(-time.Duration(daysAgo) * 24 * time.Hour).UnixMilli(),
		}).Error)
	}
	addRecord(1, true, 100)
	addRecord(6, false, 200)
	addRecord(10, true, 300)
	addRecord(20, false, 400)
	addRecord(31, true, 500)

	stats, err := GetChannelTestAvailabilityStats(ChannelTestTriggerScheduled, now)
	require.NoError(t, err)
	assert.Equal(t, int64(2), stats[1].Total7d)
	assert.Equal(t, int64(1), stats[1].Successful7d)
	assert.Equal(t, int64(3), stats[1].Total15d)
	assert.Equal(t, int64(2), stats[1].Successful15d)
	assert.Equal(t, int64(4), stats[1].Total30d)
	assert.Equal(t, int64(2), stats[1].Successful30d)
	assert.Equal(t, int64(300), stats[1].LatencySum7d)
}

func TestCreateChannelTestRecordKeepsSeparateScheduledAndManualHistory(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&Channel{Id: 1}).Error)
	baseTestedAt := time.Now().UnixMilli()

	for i := 1; i <= ChannelTestHistoryLimit+1; i++ {
		require.NoError(t, CreateChannelTestRecord(&ChannelTestRecord{
			ChannelId:   1,
			TriggerType: ChannelTestTriggerManual,
			ModelName:   "manual-model",
			Success:     true,
			TestedAt:    baseTestedAt + int64(i),
		}))
	}
	require.NoError(t, CreateChannelTestRecord(&ChannelTestRecord{
		ChannelId:   1,
		TriggerType: ChannelTestTriggerScheduled,
		ModelName:   "scheduled-model",
		Success:     true,
		TestedAt:    baseTestedAt,
	}))

	manual, err := GetLatestChannelTestRecords(1, ChannelTestTriggerManual, ChannelTestHistoryLimit)
	require.NoError(t, err)
	require.Len(t, manual, ChannelTestHistoryLimit)
	scheduled, err := GetLatestChannelTestRecords(1, ChannelTestTriggerScheduled, ChannelTestHistoryLimit)
	require.NoError(t, err)
	require.Len(t, scheduled, 1)
	assert.Equal(t, "scheduled-model", scheduled[0].ModelName)
}
