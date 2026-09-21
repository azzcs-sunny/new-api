package operation_setting

import (
	"fmt"
	"os"
	"slices"
	"strconv"

	"github.com/QuantumNous/new-api/setting/config"
)

type MonitorSetting struct {
	AutoTestChannelEnabled        bool    `json:"auto_test_channel_enabled"`
	AutoTestChannelMinutes        float64 `json:"auto_test_channel_minutes"`
	ChannelTestMode               string  `json:"channel_test_mode"`
	ChannelTestConcurrency        int     `json:"channel_test_concurrency"`
	ChannelTestDisabledChannelIds []int   `json:"channel_test_disabled_channel_ids"`
	ChannelStatusHealthySeconds   int     `json:"channel_status_healthy_seconds"`
	ChannelStatusHiddenChannelIds []int   `json:"channel_status_hidden_channel_ids"`
}

const (
	ChannelTestModeScheduledAll    = "scheduled_all"
	ChannelTestModeAutoBanOnly     = "auto_ban_only"
	ChannelTestModePassiveRecovery = "passive_recovery"

	ChannelTestConcurrencyOptionKey        = "monitor_setting.channel_test_concurrency"
	ChannelTestDisabledChannelIdsOptionKey = "monitor_setting.channel_test_disabled_channel_ids"
	ChannelStatusHealthySecondsOptionKey   = "monitor_setting.channel_status_healthy_seconds"
	ChannelStatusHiddenChannelIdsOptionKey = "monitor_setting.channel_status_hidden_channel_ids"
	DefaultChannelTestConcurrency          = 1
	MaxChannelTestConcurrency              = 32
	DefaultChannelStatusHealthySeconds     = 12
	MaxChannelStatusHealthySeconds         = 300
)

// 默认配置
var monitorSetting = MonitorSetting{
	AutoTestChannelEnabled:      false,
	AutoTestChannelMinutes:      10,
	ChannelTestMode:             ChannelTestModeScheduledAll,
	ChannelTestConcurrency:      DefaultChannelTestConcurrency,
	ChannelStatusHealthySeconds: DefaultChannelStatusHealthySeconds,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("monitor_setting", &monitorSetting)
}

func GetMonitorSetting() *MonitorSetting {
	if os.Getenv("CHANNEL_TEST_FREQUENCY") != "" {
		frequency, err := strconv.Atoi(os.Getenv("CHANNEL_TEST_FREQUENCY"))
		if err == nil && frequency > 0 {
			monitorSetting.AutoTestChannelEnabled = true
			monitorSetting.AutoTestChannelMinutes = float64(frequency)
			monitorSetting.ChannelTestMode = ChannelTestModeScheduledAll
		}
	}
	if enabled, ok := os.LookupEnv("CHANNEL_TEST_ENABLED"); ok {
		parsed, err := strconv.ParseBool(enabled)
		if err == nil {
			monitorSetting.AutoTestChannelEnabled = parsed
		}
	}
	switch monitorSetting.ChannelTestMode {
	case ChannelTestModeAutoBanOnly, ChannelTestModePassiveRecovery:
	default:
		monitorSetting.ChannelTestMode = ChannelTestModeScheduledAll
	}
	monitorSetting.ChannelTestConcurrency = NormalizeChannelTestConcurrency(monitorSetting.ChannelTestConcurrency)
	monitorSetting.ChannelStatusHealthySeconds = NormalizeChannelStatusHealthySeconds(monitorSetting.ChannelStatusHealthySeconds)
	return &monitorSetting
}

func GetChannelStatusHealthyLatencyMs() int64 {
	return int64(NormalizeChannelStatusHealthySeconds(GetMonitorSetting().ChannelStatusHealthySeconds)) * 1000
}

func GetChannelTestDisabledChannelIds() []int {
	return slices.Clone(GetMonitorSetting().ChannelTestDisabledChannelIds)
}

func IsChannelActiveTestEnabled(channelId int) bool {
	return !slices.Contains(GetMonitorSetting().ChannelTestDisabledChannelIds, channelId)
}

func GetChannelStatusHiddenChannelIds() []int {
	return slices.Clone(GetMonitorSetting().ChannelStatusHiddenChannelIds)
}

func IsChannelStatusVisible(channelId int) bool {
	return !slices.Contains(GetMonitorSetting().ChannelStatusHiddenChannelIds, channelId)
}

func NormalizeChannelTestConcurrency(concurrency int) int {
	if concurrency < 1 {
		return DefaultChannelTestConcurrency
	}
	if concurrency > MaxChannelTestConcurrency {
		return MaxChannelTestConcurrency
	}
	return concurrency
}

func ValidateChannelTestConcurrency(value string) error {
	concurrency, err := strconv.Atoi(value)
	if err != nil || concurrency < 1 || concurrency > MaxChannelTestConcurrency {
		return fmt.Errorf("channel test concurrency must be between 1 and %d", MaxChannelTestConcurrency)
	}
	return nil
}

func ValidateChannelTestDisabledChannelIds(channelIds []int) error {
	seen := make(map[int]struct{}, len(channelIds))
	for _, channelId := range channelIds {
		if channelId <= 0 {
			return fmt.Errorf("channel test disabled channel IDs must be positive")
		}
		if _, exists := seen[channelId]; exists {
			return fmt.Errorf("channel test disabled channel IDs must be unique")
		}
		seen[channelId] = struct{}{}
	}
	return nil
}

func NormalizeChannelStatusHealthySeconds(seconds int) int {
	if seconds < 1 || seconds > MaxChannelStatusHealthySeconds {
		return DefaultChannelStatusHealthySeconds
	}
	return seconds
}

func ValidateChannelStatusHealthySeconds(value string) error {
	seconds, err := strconv.Atoi(value)
	if err != nil || seconds < 1 || seconds > MaxChannelStatusHealthySeconds {
		return fmt.Errorf("channel status healthy threshold must be between 1 and %d seconds", MaxChannelStatusHealthySeconds)
	}
	return nil
}

func ValidateChannelStatusHiddenChannelIds(channelIds []int) error {
	seen := make(map[int]struct{}, len(channelIds))
	for _, channelId := range channelIds {
		if channelId <= 0 {
			return fmt.Errorf("channel status hidden channel IDs must be positive")
		}
		if _, exists := seen[channelId]; exists {
			return fmt.Errorf("channel status hidden channel IDs must be unique")
		}
		seen[channelId] = struct{}{}
	}
	return nil
}
