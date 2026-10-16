package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestAppendStreamStatusIncludesStructuredUpstreamError(t *testing.T) {
	status := relaycommon.NewStreamStatus()
	status.MarkFailed("invalid_api_key", "invalid_request_error", 401)
	status.SetEndReason(relaycommon.StreamEndReasonDone, nil)
	relayInfo := &relaycommon.RelayInfo{IsStream: true, StreamStatus: status}
	other := model.NewLogOther()

	appendStreamStatus(relayInfo, other)

	streamInfo, ok := other.Snapshot()["stream_status"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "error", streamInfo["status"])
	require.Equal(t, "failed", streamInfo["response_status"])
	require.Equal(t, "invalid_api_key", streamInfo["error_code"])
	require.Equal(t, "invalid_request_error", streamInfo["error_type"])
	require.Equal(t, 401, streamInfo["error_status"])
}

func TestAppendStreamStatusIncludesIncompleteReason(t *testing.T) {
	status := relaycommon.NewStreamStatus()
	status.MarkIncomplete("max_output_tokens")
	status.SetEndReason(relaycommon.StreamEndReasonDone, nil)
	relayInfo := &relaycommon.RelayInfo{IsStream: true, StreamStatus: status}
	other := model.NewLogOther()

	appendStreamStatus(relayInfo, other)

	streamInfo, ok := other.Snapshot()["stream_status"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "incomplete", streamInfo["response_status"])
	require.Equal(t, "max_output_tokens", streamInfo["incomplete_reason"])
}
