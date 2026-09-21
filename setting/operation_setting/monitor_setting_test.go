package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetMonitorSetting_ChannelTestEnabledEnvOverridesEnabledConfig(t *testing.T) {
	orig := monitorSetting
	t.Cleanup(func() { monitorSetting = orig })

	t.Setenv("CHANNEL_TEST_ENABLED", "false")
	t.Setenv("CHANNEL_TEST_FREQUENCY", "5")
	monitorSetting = MonitorSetting{
		AutoTestChannelEnabled: true,
		AutoTestChannelMinutes: 20,
	}

	setting := GetMonitorSetting()

	require.NotNil(t, setting)
	assert.False(t, setting.AutoTestChannelEnabled)
	assert.Equal(t, float64(5), setting.AutoTestChannelMinutes)
}

func TestGetMonitorSetting_ChannelTestEnabledEnvCanEnableDisabledConfig(t *testing.T) {
	orig := monitorSetting
	t.Cleanup(func() { monitorSetting = orig })

	t.Setenv("CHANNEL_TEST_ENABLED", "true")
	monitorSetting = MonitorSetting{
		AutoTestChannelEnabled: false,
		AutoTestChannelMinutes: 12,
	}

	setting := GetMonitorSetting()

	require.NotNil(t, setting)
	assert.True(t, setting.AutoTestChannelEnabled)
	assert.Equal(t, float64(12), setting.AutoTestChannelMinutes)
}

func TestGetMonitorSettingPreservesAutoBanOnlyMode(t *testing.T) {
	orig := monitorSetting
	t.Cleanup(func() { monitorSetting = orig })

	t.Setenv("CHANNEL_TEST_ENABLED", "")
	t.Setenv("CHANNEL_TEST_FREQUENCY", "")
	monitorSetting = MonitorSetting{ChannelTestMode: ChannelTestModeAutoBanOnly}

	setting := GetMonitorSetting()

	require.NotNil(t, setting)
	assert.Equal(t, ChannelTestModeAutoBanOnly, setting.ChannelTestMode)
}

func TestGetMonitorSettingNormalizesChannelTestConcurrency(t *testing.T) {
	orig := monitorSetting
	t.Cleanup(func() { monitorSetting = orig })

	tests := []struct {
		name        string
		concurrency int
		want        int
	}{
		{name: "missing uses safe default", concurrency: 0, want: DefaultChannelTestConcurrency},
		{name: "configured value is preserved", concurrency: 8, want: 8},
		{name: "oversized value is capped", concurrency: MaxChannelTestConcurrency + 1, want: MaxChannelTestConcurrency},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			monitorSetting = MonitorSetting{ChannelTestConcurrency: test.concurrency}

			setting := GetMonitorSetting()

			require.NotNil(t, setting)
			assert.Equal(t, test.want, setting.ChannelTestConcurrency)
		})
	}
}

func TestValidateChannelTestConcurrency(t *testing.T) {
	require.NoError(t, ValidateChannelTestConcurrency("1"))
	require.NoError(t, ValidateChannelTestConcurrency("32"))
	assert.Error(t, ValidateChannelTestConcurrency("0"))
	assert.Error(t, ValidateChannelTestConcurrency("33"))
	assert.Error(t, ValidateChannelTestConcurrency("1.5"))
}

func TestValidateChannelTestDisabledChannelIds(t *testing.T) {
	require.NoError(t, ValidateChannelTestDisabledChannelIds(nil))
	require.NoError(t, ValidateChannelTestDisabledChannelIds([]int{1, 7}))
	assert.Error(t, ValidateChannelTestDisabledChannelIds([]int{0}))
	assert.Error(t, ValidateChannelTestDisabledChannelIds([]int{3, 3}))
}

func TestChannelStatusHealthyThresholdValidationAndNormalization(t *testing.T) {
	require.NoError(t, ValidateChannelStatusHealthySeconds("1"))
	require.NoError(t, ValidateChannelStatusHealthySeconds("300"))
	assert.Error(t, ValidateChannelStatusHealthySeconds("0"))
	assert.Error(t, ValidateChannelStatusHealthySeconds("301"))
	assert.Error(t, ValidateChannelStatusHealthySeconds("12.5"))
	assert.Equal(t, DefaultChannelStatusHealthySeconds, NormalizeChannelStatusHealthySeconds(0))
	assert.Equal(t, 24, NormalizeChannelStatusHealthySeconds(24))
}

func TestValidateChannelStatusHiddenChannelIds(t *testing.T) {
	require.NoError(t, ValidateChannelStatusHiddenChannelIds(nil))
	require.NoError(t, ValidateChannelStatusHiddenChannelIds([]int{1, 7}))
	assert.Error(t, ValidateChannelStatusHiddenChannelIds([]int{0}))
	assert.Error(t, ValidateChannelStatusHiddenChannelIds([]int{3, 3}))
}
