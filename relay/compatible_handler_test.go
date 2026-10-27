package relay

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/iotest"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChatResponseMislabeledJSON(t *testing.T) {
	const body = `{"id":"chat-1","object":"chat.completion","created":1792649730,"model":"deepseek-v4.1-flash","choices":[{"index":0,"message":{"role":"","content":"好的"},"finish_reason":"stop"}],"usage":{"prompt_tokens":9,"completion_tokens":1,"total_tokens":10},"vendor":"preserved"}`
	for _, tc := range []struct {
		name        string
		setting     string
		stream      bool
		priorStream bool
		contentType string
		body        string
		wantStream  bool
	}{
		{name: "opt in restores JSON and upstream usage", setting: `{"nonstream_json_sse_compat":true}`, contentType: "text/event-stream", body: body},
		{name: "retry uses original client stream preference", setting: `{"nonstream_json_sse_compat":true}`, priorStream: true, contentType: "text/event-stream", body: body},
		{name: "leading JSON whitespace", setting: `{"nonstream_json_sse_compat":true}`, contentType: "text/event-stream; charset=utf-8", body: " \r\n\t" + body},
		{name: "default off", contentType: "text/event-stream", body: body, wantStream: true},
		{name: "explicit off", setting: `{"nonstream_json_sse_compat":false}`, contentType: "text/event-stream", body: body, wantStream: true},
		{name: "streaming client unchanged", setting: `{"nonstream_json_sse_compat":true}`, stream: true, contentType: "text/event-stream", body: body, wantStream: true},
		{name: "correct JSON header unchanged", setting: `{"nonstream_json_sse_compat":true}`, contentType: "application/json", body: body},
		{name: "genuine SSE preserved", setting: `{"nonstream_json_sse_compat":true}`, contentType: "text/event-stream", body: ": heartbeat\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"好的\"}}]}\n\ndata: [DONE]\n\n", wantStream: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var settings dto.ChannelSettings
			if tc.setting != "" {
				require.NoError(t, common.UnmarshalJsonStr(tc.setting, &settings))
			}
			info := &relaycommon.RelayInfo{
				IsStream: tc.stream || tc.priorStream, RelayMode: relayconstant.RelayModeChatCompletions,
				RelayFormat: types.RelayFormatOpenAI, StartTime: time.Now(),
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType: constant.ChannelTypeOpenAI, ChannelSetting: settings,
					UpstreamModelName: "deepseek-v4.1-flash",
				},
			}
			upstream := &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": {tc.contentType}},
				Body:       io.NopCloser(strings.NewReader(tc.body)),
			}
			t.Cleanup(func() { _ = upstream.Body.Close() })
			require.Nil(t, prepareChatResponse(info, upstream, tc.stream))
			assert.Equal(t, tc.wantStream, info.IsStream)
			if tc.wantStream {
				assert.Equal(t, tc.contentType, upstream.Header.Get("Content-Type"))
				data, err := io.ReadAll(upstream.Body)
				require.NoError(t, err)
				assert.Equal(t, tc.body, string(data))
				return
			}
			require.Equal(t, "application/json", upstream.Header.Get("Content-Type"))
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			adaptor := openai.Adaptor{}
			usage, apiErr := adaptor.DoResponse(ctx, upstream, info)
			require.Nil(t, apiErr)
			require.IsType(t, &dto.Usage{}, usage)
			assert.Equal(t, 9, usage.(*dto.Usage).PromptTokens)
			assert.Equal(t, 1, usage.(*dto.Usage).CompletionTokens)
			assert.Equal(t, 10, usage.(*dto.Usage).TotalTokens)
			assert.JSONEq(t, body, recorder.Body.String())
			assert.Equal(t, "application/json", recorder.Header().Get("Content-Type"))
		})
	}
}

func TestChatResponseCompatibilityScope(t *testing.T) {
	const body = `{"object":"chat.completion","choices":[]}`
	for _, tc := range []struct {
		name   string
		mode   int
		format types.RelayFormat
		status int
	}{
		{"responses excluded", relayconstant.RelayModeResponses, types.RelayFormatOpenAIResponses, http.StatusOK},
		{"legacy completions excluded", relayconstant.RelayModeCompletions, types.RelayFormatOpenAI, http.StatusOK},
		{"protocol conversion excluded", relayconstant.RelayModeChatCompletions, types.RelayFormatClaude, http.StatusOK},
		{"HTTP errors retain existing handling", relayconstant.RelayModeChatCompletions, types.RelayFormatOpenAI, http.StatusBadGateway},
	} {
		t.Run(tc.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				RelayMode: tc.mode, RelayFormat: tc.format,
				ChannelMeta: &relaycommon.ChannelMeta{ChannelSetting: dto.ChannelSettings{NonStreamJSONSSECompat: true}},
			}
			resp := &http.Response{
				StatusCode: tc.status, Header: http.Header{"Content-Type": {"text/event-stream"}},
				Body: io.NopCloser(strings.NewReader(body)),
			}
			defer resp.Body.Close()
			require.Nil(t, prepareChatResponse(info, resp, false))
			assert.True(t, info.IsStream)
			assert.Equal(t, "text/event-stream", resp.Header.Get("Content-Type"))
			data, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			assert.Equal(t, body, string(data))
		})
	}
}

func TestChatResponseCompatibilityErrorsAndBodyLifecycle(t *testing.T) {
	readErr := errors.New("upstream read failed")
	for _, tc := range []struct {
		name    string
		reader  io.Reader
		code    types.ErrorCode
		apiCode string
	}{
		{name: "truncated JSON rejected", reader: strings.NewReader(`{"object":"chat.completion","choices":[`), code: types.ErrorCodeBadResponseBody},
		{name: "unrelated JSON rejected", reader: strings.NewReader(`{"object":"response","output":[]}`), code: types.ErrorCodeBadResponseBody},
		{name: "trailing garbage rejected", reader: strings.NewReader(`{"object":"chat.completion","choices":[]}junk`), code: types.ErrorCodeBadResponseBody},
		{name: "JSON read failure", reader: io.MultiReader(strings.NewReader(`{`), iotest.ErrReader(readErr)), code: types.ErrorCodeReadResponseBodyFailed},
		{name: "prefix read failure", reader: iotest.ErrReader(readErr), code: types.ErrorCodeReadResponseBodyFailed},
		{name: "JSON error stays an error", reader: strings.NewReader(`{"error":{"type":"server_error","code":"upstream_failed","message":"failed"}}`), apiCode: "upstream_failed"},
		// The next read fails: recognizing SSE must not wait for the whole stream.
		{name: "SSE is not buffered to EOF", reader: io.MultiReader(strings.NewReader("data: {}\n\n"), iotest.ErrReader(readErr))},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := &chatResponseTestBody{Reader: tc.reader}
			resp := &http.Response{
				StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"text/event-stream"}}, Body: body,
			}
			info := &relaycommon.RelayInfo{
				RelayMode: relayconstant.RelayModeChatCompletions, RelayFormat: types.RelayFormatOpenAI,
				ChannelMeta: &relaycommon.ChannelMeta{ChannelSetting: dto.ChannelSettings{NonStreamJSONSSECompat: true}},
			}
			apiErr := prepareChatResponse(info, resp, false)
			assert.False(t, body.closed)
			if tc.code != "" {
				require.NotNil(t, apiErr)
				assert.Equal(t, tc.code, apiErr.GetErrorCode())
				assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
			} else {
				require.Nil(t, apiErr)
				if tc.apiCode != "" {
					recorder := httptest.NewRecorder()
					ctx, _ := gin.CreateTestContext(recorder)
					adaptor := openai.Adaptor{}
					usage, responseErr := adaptor.DoResponse(ctx, resp, info)
					require.NotNil(t, responseErr)
					assert.Nil(t, usage)
					assert.Equal(t, types.ErrorCode(tc.apiCode), responseErr.GetErrorCode())
					assert.Empty(t, recorder.Body.String())
				}
			}
			require.NoError(t, resp.Body.Close())
			assert.True(t, body.closed)
		})
	}
}

type chatResponseTestBody struct {
	io.Reader
	closed bool
}

func (b *chatResponseTestBody) Close() error {
	b.closed = true
	return nil
}
