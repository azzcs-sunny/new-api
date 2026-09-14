package xai

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEstimateBillingUsesSecondsAndResolutionRatios(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("task_request", relaycommon.TaskSubmitReq{
		Prompt:   "a cinematic city",
		Seconds:  "10",
		Metadata: map[string]interface{}{"resolution": "1080p"},
	})

	ratios := (&TaskAdaptor{}).EstimateBilling(c, &relaycommon.RelayInfo{OriginModelName: "grok-imagine-video"})

	require.Equal(t, 10.0, ratios["seconds"])
	assert.Equal(t, 2.0, ratios["resolution"])
}

func TestSupportedResolutionDependsOnModel(t *testing.T) {
	assert.True(t, isSupportedResolution("grok-imagine-video", "480p"))
	assert.True(t, isSupportedResolution("grok-imagine-video", "720p"))
	assert.False(t, isSupportedResolution("grok-imagine-video", "1080p"))
	assert.True(t, isSupportedResolution("grok-imagine-video-1.5", "1080p"))
}

func TestMultipartRequestIsRebuiltAsXAIJSON(t *testing.T) {
	var incoming bytes.Buffer
	writer := multipart.NewWriter(&incoming)
	require.NoError(t, writer.WriteField("model", "grok-imagine-video"))
	require.NoError(t, writer.WriteField("prompt", "a cinematic city"))
	require.NoError(t, writer.WriteField("seconds", "8"))
	require.NoError(t, writer.WriteField("size", "1280x720"))
	require.NoError(t, writer.WriteField("resolution_name", "720p"))
	require.NoError(t, writer.Close())

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewReader(incoming.Bytes()))
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	info := &relaycommon.RelayInfo{
		OriginModelName: "grok-imagine-video",
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "grok-imagine-video",
		},
	}

	taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(c, info)
	require.Nil(t, taskErr)

	body, err := (&TaskAdaptor{}).BuildRequestBody(c, info)
	require.NoError(t, err)
	rawBody, err := io.ReadAll(body)
	require.NoError(t, err)

	var payload requestPayload
	require.NoError(t, common.Unmarshal(rawBody, &payload))
	assert.Equal(t, "grok-imagine-video", payload.Model)
	assert.Equal(t, "a cinematic city", payload.Prompt)
	assert.Equal(t, 8, payload.Duration)
	assert.Equal(t, "720p", payload.Resolution)
	assert.Equal(t, "16:9", payload.AspectRatio)

	upstreamRequest := httptest.NewRequest(http.MethodPost, "/v1/videos/generations", bytes.NewReader(rawBody))
	require.NoError(t, (&TaskAdaptor{}).BuildRequestHeader(c, upstreamRequest, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ApiKey: "test-key"},
	}))
	assert.Equal(t, "application/json", upstreamRequest.Header.Get("Content-Type"))
}

func TestParseTaskResultDoneIncludesVideoURL(t *testing.T) {
	result, err := (&TaskAdaptor{}).ParseTaskResult(&model.Task{}, &http.Response{}, []byte(`{
		"status":"done",
		"model":"grok-imagine-video",
		"progress":100,
		"video":{"url":"https://cdn.example/video.mp4","duration":6}
	}`))

	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusSuccess, result.Status)
	assert.Equal(t, "https://cdn.example/video.mp4", result.Url)
	assert.Equal(t, "100%", result.Progress)
}

func TestParseTaskResultFailureReturnsProviderReason(t *testing.T) {
	result, err := (&TaskAdaptor{}).ParseTaskResult(&model.Task{}, &http.Response{}, []byte(`{
		"status":"failed",
		"error":{"code":"moderation","message":"request rejected"}
	}`))

	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusFailure, result.Status)
	assert.Equal(t, "request rejected", result.Reason)
}
