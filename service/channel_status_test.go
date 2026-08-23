package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
)

func TestChannelTestHealthUsesLatestResultAndLatency(t *testing.T) {
	tests := []struct {
		name     string
		record   model.ChannelTestRecord
		expected ChannelStatusHealth
	}{
		{name: "fast success", record: model.ChannelTestRecord{Success: true, LatencyMs: 8000}, expected: ChannelStatusHealthHealthy},
		{name: "slow success", record: model.ChannelTestRecord{Success: true, LatencyMs: 9000}, expected: ChannelStatusHealthWarning},
		{name: "too slow", record: model.ChannelTestRecord{Success: true, LatencyMs: 15001}, expected: ChannelStatusHealthCritical},
		{name: "fast failure", record: model.ChannelTestRecord{Success: false, LatencyMs: 100}, expected: ChannelStatusHealthCritical},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, channelTestHealth(tt.record))
		})
	}
}
