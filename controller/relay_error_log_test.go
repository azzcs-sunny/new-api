package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaychannel "github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/newapi"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestProcessChannelErrorUsesSnapshotWithoutLeakingChannelMetadata(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousMainDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()
	previousErrorLogEnabled := constant.ErrorLogEnabled

	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, database.AutoMigrate(&model.User{}, &model.Log{}))
	model.DB, model.LOG_DB = database, database
	common.RedisEnabled = false
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	constant.ErrorLogEnabled = true
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedisEnabled
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		constant.ErrorLogEnabled = previousErrorLogEnabled
		require.NoError(t, sqlDB.Close())
	})

	require.NoError(t, database.Create(&model.User{Id: 7, Username: "log-owner", Group: "default"}).Error)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("id", 7)
	ctx.Set("username", "log-owner")
	ctx.Set("token_name", "test-token")
	ctx.Set("token_id", 11)
	ctx.Set("original_model", "gpt-test")
	ctx.Set("group", "default")
	ctx.Set("channel_id", 202)
	ctx.Set("channel_name", "mutable-context-channel")
	ctx.Set("channel_type", 9)
	ctx.Set("use_channel", []string{"101"})
	common.SetContextKey(ctx, constant.ContextKeyRequestStartTime, time.Now().Add(-time.Second))

	channelSnapshot := types.ChannelError{
		ChannelId:   101,
		ChannelType: 1,
		ChannelName: "snapshot-channel",
		AutoBan:     false,
	}
	apiErr := types.NewOpenAIError(errors.New("upstream failed"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway)

	processChannelError(ctx, channelSnapshot, apiErr, nil)

	var stored model.Log
	require.NoError(t, database.First(&stored).Error)
	assert.Equal(t, channelSnapshot.ChannelId, stored.ChannelId)
	storedOther, err := common.StrToMap(stored.Other)
	require.NoError(t, err)
	assert.Equal(t, float64(http.StatusBadGateway), storedOther["status_code"])
	for _, key := range []string{"channel_id", "channel_name", "channel_type"} {
		assert.NotContains(t, storedOther, key)
	}
	adminInfo, ok := storedOther["admin_info"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, []any{"101"}, adminInfo["use_channel"])

	logs, total, err := model.GetUserLogs(7, model.LogTypeError, 0, 0, "", "", 0, 10, "", "", "", nil)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, logs, 1)
	assert.Equal(t, channelSnapshot.ChannelId, logs[0].ChannelId)
	assert.Empty(t, logs[0].ChannelName)
	userOther, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	assert.NotContains(t, userOther, "admin_info")
	for _, key := range []string{"channel_id", "channel_name", "channel_type"} {
		assert.NotContains(t, userOther, key)
	}
}

func TestRelayRetryStopsAfterCancellationOrResponse(t *testing.T) {
	for _, scenario := range []string{"canceled", "response started", "retryable before response"} {
		t.Run(scenario, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil).WithContext(ctx)
			if scenario == "canceled" {
				cancel()
			}
			if scenario == "response started" {
				_, err := c.Writer.Write([]byte("data: partial\n\n"))
				require.NoError(t, err)
			}
			// Channel errors used to bypass all of the retry exclusions.
			apiErr := types.NewError(errors.New("upstream failed"), types.ErrorCodeChannelNoAvailableKey)
			decision := service.DecideRelayRetry(c, apiErr, 3)
			if scenario == "retryable before response" {
				assert.Equal(t, "retry", decision.Action)
			} else {
				assert.Equal(t, "stop", decision.Action)
			}
		})
	}
}

type cancelResponsesWriter struct {
	gin.ResponseWriter
	cancel context.CancelFunc
	marker string
	fail   bool
}

func (w *cancelResponsesWriter) Write(data []byte) (int, error) {
	if w.fail && strings.Contains(string(data), w.marker) {
		w.cancel()
		return 0, io.ErrClosedPipe
	}
	n, err := w.ResponseWriter.Write(data)
	if strings.Contains(string(data), w.marker) {
		w.cancel()
	}
	return n, err
}

// Runs against SQLite by default, or isolated main/log databases configured by
// TEST_RESPONSES_SQL_DSN and TEST_RESPONSES_LOG_SQL_DSN through the shared fixture.
func TestClaudeResponsesInterruptedBilling(t *testing.T) {
	const start = `data: {"type":"message_start","message":{"id":"msg_billing","type":"message","role":"assistant","model":"claude-billing-test","content":[],"usage":{"input_tokens":44,"output_tokens":1,"cache_read_input_tokens":100,"cache_creation_input_tokens":20}}}` + "\n\n" +
		`data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}` + "\n\n" +
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello world."}}` + "\n\n"
	const finish = `data: {"type":"content_block_stop","index":0}` + "\n\n" +
		`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":20}}` + "\n\n" +
		`data: {"type":"message_stop"}` + "\n\n"
	const failure = `data: {"type":"error","error":{"type":"overloaded_error","message":"overloaded"}}` + "\n\n"
	for _, tc := range []struct {
		name, marker, body                                string
		cancelBeforeHeaders, disableLogs, enableErrorLogs bool
		wantQuota, wantOutput, wantAttempts               int
		successful                                        bool
		drain, drainTimeout, writeFailure                 bool
		afterDisconnect                                   string
		format                                            types.RelayFormat
		channelType                                       int
	}{
		{name: "drain write failure", drain: true, writeFailure: true, format: types.RelayFormatClaude, marker: "Hello world.", body: start, afterDisconnect: finish, wantQuota: 219, wantOutput: 20, wantAttempts: 1, successful: true},
		{name: "drain before headers deadline", drain: true, drainTimeout: true, cancelBeforeHeaders: true, wantAttempts: 1},
		{name: "drain retry before response", drain: true, body: start + finish, wantQuota: 219, wantOutput: 20, wantAttempts: 2, successful: true},
		{name: "drain normal completion", drain: true, body: start + finish, wantQuota: 219, wantOutput: 20, wantAttempts: 1, successful: true},
		{name: "drain Responses disconnect", drain: true, marker: "event: response.output_text.delta", body: start, afterDisconnect: finish, wantQuota: 219, wantOutput: 20, wantAttempts: 1, successful: true},
		{name: "drain Claude disconnect", drain: true, format: types.RelayFormatClaude, marker: "Hello world.", body: start, afterDisconnect: finish, wantQuota: 219, wantOutput: 20, wantAttempts: 1, successful: true},
		{name: "drain Chat disconnect", drain: true, format: types.RelayFormatOpenAI, marker: "Hello world.", body: start, afterDisconnect: finish, wantQuota: 219, wantOutput: 20, wantAttempts: 1, successful: true},
		{name: "drain Sub2API Claude", drain: true, channelType: constant.ChannelTypeSub2API, format: types.RelayFormatClaude, marker: "Hello world.", body: start, afterDisconnect: finish, wantQuota: 219, wantOutput: 20, wantAttempts: 1, successful: true},
		{name: "drain advanced native Claude", drain: true, channelType: constant.ChannelTypeAdvancedCustom, format: types.RelayFormatClaude, marker: "Hello world.", body: start, afterDisconnect: finish, wantQuota: 219, wantOutput: 20, wantAttempts: 1, successful: true},
		{name: "drain advanced Chat to Claude", drain: true, channelType: constant.ChannelTypeAdvancedCustom, format: types.RelayFormatOpenAI, marker: "Hello world.", body: start, afterDisconnect: finish, wantQuota: 219, wantOutput: 20, wantAttempts: 1, successful: true},
		{name: "drain NewAPI Claude", drain: true, channelType: constant.ChannelTypeNewAPI, format: types.RelayFormatClaude, marker: "Hello world.", body: start, afterDisconnect: finish, wantQuota: 219, wantOutput: 20, wantAttempts: 1, successful: true},
		{name: "drain error settles partial", drain: true, format: types.RelayFormatClaude, marker: "Hello world.", body: start, afterDisconnect: failure, wantQuota: 187, wantOutput: 4, wantAttempts: 1},
		{name: "drain Responses error settles partial", drain: true, marker: "event: response.output_text.delta", body: start, afterDisconnect: failure, wantQuota: 187, wantOutput: 4, wantAttempts: 1},
		{name: "drain timeout settles partial", drain: true, drainTimeout: true, format: types.RelayFormatClaude, marker: "Hello world.", body: start, wantQuota: 187, wantOutput: 4, wantAttempts: 1},
		{name: "drain truncated stream settles partial", drain: true, body: start, wantQuota: 187, wantOutput: 4, wantAttempts: 1},
		{name: "drain empty error refunds", drain: true, body: failure, wantAttempts: 1},
		{name: "drain already canceled never submits", drain: true},
		{name: "normal completion", body: start + finish, wantQuota: 219, wantOutput: 20, wantAttempts: 1, successful: true},
		{name: "retry before response", body: start + finish, wantQuota: 219, wantOutput: 20, wantAttempts: 2, successful: true},
		{name: "cancel during output", marker: "event: response.output_text.delta", body: start, wantQuota: 187, wantOutput: 4, wantAttempts: 1},
		{name: "cancel after complete usage", marker: "event: response.completed", body: start + finish, wantQuota: 219, wantOutput: 20, wantAttempts: 1},
		{name: "upstream error after output", body: start + failure, wantQuota: 187, wantOutput: 4, wantAttempts: 1},
		{name: "truncated upstream after output", body: start, wantQuota: 187, wantOutput: 4, wantAttempts: 1},
		{name: "error without usage refunds", body: failure, wantAttempts: 1},
		{name: "cancel before response headers refunds", cancelBeforeHeaders: true, wantAttempts: 1},
		{name: "already canceled never submits"},
		{name: "cancel with error logging enabled", cancelBeforeHeaders: true, enableErrorLogs: true, wantAttempts: 1},
		{name: "cancellation respects disabled logging", cancelBeforeHeaders: true, disableLogs: true, wantAttempts: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			user, token := setupResponsesWSRequestTest(t)
			db, logDB := model.DB, model.LOG_DB
			previousRetries, previousBatch, previousLogs := common.RetryTimes, common.BatchUpdateEnabled, common.LogConsumeEnabled
			previousCount, previousTimeout, previousErrorLogs := constant.CountToken, constant.StreamingTimeout, constant.ErrorLogEnabled
			previousQuota := common.QuotaPerUnit
			previousPing := operation_setting.GetGeneralSetting().PingIntervalEnabled
			previousAutoDisable := common.AutomaticDisableChannelEnabled
			common.RetryTimes, common.BatchUpdateEnabled, common.LogConsumeEnabled = 3, false, !tc.disableLogs
			constant.CountToken, constant.StreamingTimeout, constant.ErrorLogEnabled = false, 30, tc.enableErrorLogs
			common.QuotaPerUnit = 500000
			common.AutomaticDisableChannelEnabled = false
			operation_setting.GetGeneralSetting().PingIntervalEnabled = false
			saved := map[string]string{}
			require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
				switch key {
				case "billing_setting.billing_mode", "billing_setting.billing_expr", "group_ratio_setting.group_ratio", "perf_metrics_setting.enabled":
					saved[key] = value
				}
				return nil
			}))
			t.Cleanup(func() {
				common.RetryTimes, common.BatchUpdateEnabled, common.LogConsumeEnabled = previousRetries, previousBatch, previousLogs
				constant.CountToken, constant.StreamingTimeout, constant.ErrorLogEnabled = previousCount, previousTimeout, previousErrorLogs
				common.QuotaPerUnit = previousQuota
				common.AutomaticDisableChannelEnabled = previousAutoDisable
				operation_setting.GetGeneralSetting().PingIntervalEnabled = previousPing
				require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
			})
			require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
				"billing_setting.billing_mode":    `{"claude-billing-test":"tiered_expr"}`,
				"billing_setting.billing_expr":    `{"claude-billing-test":"tier(\"base\", 200 + p * 2 + c * 4 + cr * 0.2 + cc * 2.5 + cc1h * 4)"}`,
				"group_ratio_setting.group_ratio": `{"default":1}`,
				"perf_metrics_setting.enabled":    "false",
			}))
			require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
			require.NoError(t, logDB.AutoMigrate(&model.Log{}))
			require.NoError(t, db.Model(user).Update("quota", 10000).Error)
			require.NoError(t, db.Model(token).Update("remain_quota", 10000).Error)
			user.Quota, token.RemainQuota = 10000, 10000
			versionQuery := "select version()"
			if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
				versionQuery = "select sqlite_version()"
			}
			var version string
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("main database: %s; separate log database: %t", version, db != logDB)

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			disconnected := make(chan struct{})
			disconnect := context.CancelFunc(cancel)
			if tc.writeFailure {
				disconnect = func() { close(disconnected) }
			} else {
				disconnected = nil
			}
			var attempts atomic.Int32
			upstreamCanceled := make(chan struct{}, 4)
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				attempt := attempts.Add(1)
				_, _ = io.Copy(io.Discard, r.Body)
				if strings.Contains(tc.name, "retry before response") && attempt == 1 {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusTooManyRequests)
					_, _ = io.WriteString(w, `{"error":{"type":"rate_limit_error","message":"try again"}}`)
					return
				}
				if tc.cancelBeforeHeaders {
					cancel()
					select {
					case <-r.Context().Done():
						upstreamCanceled <- struct{}{}
					case <-time.After(3 * time.Second):
						t.Error("upstream request did not inherit cancellation")
					}
					return
				}
				w.Header().Set("Content-Type", "text/event-stream")
				_, _ = io.WriteString(w, tc.body)
				w.(http.Flusher).Flush()
				if tc.drain && tc.marker != "" {
					select {
					case <-ctx.Done():
					case <-disconnected:
					case <-time.After(3 * time.Second):
						t.Error("client did not disconnect")
						return
					}
					if tc.drainTimeout {
						select {
						case <-r.Context().Done():
							upstreamCanceled <- struct{}{}
						case <-time.After(3 * time.Second):
							t.Error("drain deadline did not cancel upstream")
						}
						return
					}
					assert.NoError(t, r.Context().Err(), "client cancellation must not stop Claude usage collection")
					_, _ = io.WriteString(w, tc.afterDisconnect)
					w.(http.Flusher).Flush()
				}
				if tc.name == "cancel during output" {
					select {
					case <-r.Context().Done():
						upstreamCanceled <- struct{}{}
					case <-time.After(3 * time.Second):
						t.Error("upstream stream was not canceled")
					}
				}
			}))
			t.Cleanup(upstream.Close)
			channel := &model.Channel{Name: "claude-stream-billing", Key: "test-upstream-key", Type: constant.ChannelTypeAnthropic, Status: common.ChannelStatusEnabled, Group: "default", Models: "claude-billing-test", BaseURL: &upstream.URL}
			if tc.channelType != 0 {
				channel.Type = tc.channelType
			}
			settingJSON := fmt.Sprintf(`{"claude_stream_drain_enabled":%t,"claude_stream_drain_timeout":1}`, tc.drain)
			channel.Setting = &settingJSON
			if tc.channelType == constant.ChannelTypeAdvancedCustom {
				incomingPath, converter := "/v1/messages", "none"
				if tc.format == types.RelayFormatOpenAI {
					incomingPath, converter = "/v1/chat/completions", "openai_chat_completions_to_anthropic_messages"
				}
				channel.OtherSettings = fmt.Sprintf(`{"advanced_custom":{"advanced_routes":[{"incoming_path":%q,"upstream_path":"/v1/messages","converter":%q}]}}`, incomingPath, converter)
			}
			require.NoError(t, channel.ValidateSettings())
			require.NoError(t, db.Create(channel).Error)
			require.NoError(t, db.First(channel, channel.Id).Error)
			assert.Equal(t, tc.drain, channel.GetSetting().ClaudeStreamDrainEnabled)
			require.NoError(t, db.Create(&model.Ability{ChannelId: channel.Id, Model: "claude-billing-test", Group: "default", Enabled: true}).Error)
			t.Cleanup(func() {
				require.NoError(t, logDB.Where("user_id = ?", user.Id).Delete(&model.Log{}).Error)
				require.NoError(t, db.Where("channel_id = ?", channel.Id).Delete(&model.Ability{}).Error)
				require.NoError(t, db.Delete(channel).Error)
			})
			requestID := fmt.Sprintf("stream-billing-%d", user.Id)
			engine := gin.New()
			format, endpoint, body := tc.format, "/v1/responses", `{"model":"claude-billing-test","input":"hello","stream":true}`
			switch format {
			case types.RelayFormatClaude:
				endpoint, body = "/v1/messages", `{"model":"claude-billing-test","max_tokens":100,"messages":[{"role":"user","content":"hello"}],"stream":true}`
			case types.RelayFormatOpenAI:
				endpoint, body = "/v1/chat/completions", `{"model":"claude-billing-test","messages":[{"role":"user","content":"hello"}],"stream":true}`
			default:
				format = types.RelayFormatOpenAIResponses
			}
			engine.POST(endpoint, func(c *gin.Context) {
				c.Set(common.RequestIdKey, requestID)
				c.Set("id", user.Id)
				c.Set("username", user.Username)
				c.Set("user_group", "default")
				c.Set("group", "default")
				c.Set("user_quota", 10000)
				c.Set("token_id", token.Id)
				c.Set("token_key", token.Key)
				c.Set("token_quota", 10000)
				c.Set("token_name", "billing-test")
				common.SetContextKey(c, constant.ContextKeyUserSetting, dto.UserSetting{BillingPreference: "wallet_only"})
				require.Nil(t, middleware.SetupContextForSelectedChannel(c, channel, "claude-billing-test"))
				if tc.marker != "" {
					c.Writer = &cancelResponsesWriter{ResponseWriter: c.Writer, cancel: disconnect, marker: tc.marker, fail: tc.writeFailure}
				}
				Relay(c, format)
				assert.Equal(t, tc.successful, service.RequestPolicy(c).Successful)
			})
			if tc.wantAttempts == 0 {
				cancel()
			}
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, endpoint, strings.NewReader(body)).WithContext(ctx)
			req.Header.Set("Content-Type", "application/json")
			engine.ServeHTTP(rec, req)
			assert.EqualValues(t, tc.wantAttempts, attempts.Load(), "a canceled or started response must never be retried")
			if tc.cancelBeforeHeaders || tc.name == "cancel during output" || tc.drainTimeout {
				select {
				case <-upstreamCanceled:
				case <-time.After(3 * time.Second):
					t.Fatal("upstream did not observe cancellation")
				}
			}
			// Refund is asynchronous. Waiting for its observable balances also ensures
			// no refund worker outlives this fixture's database.
			require.Eventually(t, func() bool {
				var storedUser model.User
				var storedToken model.Token
				if db.First(&storedUser, user.Id).Error != nil || db.First(&storedToken, token.Id).Error != nil {
					return false
				}
				return storedUser.Quota == 10000-tc.wantQuota && storedToken.RemainQuota == 10000-tc.wantQuota
			}, 3*time.Second, 10*time.Millisecond)
			var logs []model.Log
			require.NoError(t, logDB.Where("request_id = ? AND type = ?", requestID, model.LogTypeConsume).Find(&logs).Error)
			var failures []model.Log
			require.NoError(t, logDB.Where("request_id = ? AND type = ?", requestID, model.LogTypeError).Find(&failures).Error)
			if ctx.Err() != nil && !tc.disableLogs && !tc.successful {
				require.Len(t, failures, 1, "client cancellation remains visible regardless of ERROR_LOG_ENABLED")
				assert.Zero(t, failures[0].Quota, "a cancellation log must never add a second charge")
				assert.Equal(t, "客户端取消请求", failures[0].Content)
				assert.Equal(t, channel.Id, failures[0].ChannelId)
				var cancellation map[string]any
				require.NoError(t, common.UnmarshalJsonStr(failures[0].Other, &cancellation))
				assert.Equal(t, "client_canceled", cancellation["error_code"])
				assert.Equal(t, float64(499), cancellation["status_code"])
				var audit struct {
					Admin struct {
						Events []service.PolicyEvent `json:"request_policy"`
					} `json:"admin_info"`
				}
				require.NoError(t, common.UnmarshalJsonStr(failures[0].Other, &audit))
				require.NotEmpty(t, audit.Admin.Events)
				last := audit.Admin.Events[len(audit.Admin.Events)-1]
				assert.Equal(t, "client", last.ErrorSource)
				assert.Equal(t, "unchanged", last.Health)
				visible, total, err := model.GetUserLogs(user.Id, model.LogTypeUnknown, 0, 0, "", "", 0, 10, "", requestID, "", nil)
				require.NoError(t, err)
				assert.EqualValues(t, len(logs)+1, total)
				assert.Len(t, visible, len(logs)+1)
			} else {
				assert.Empty(t, failures, "ordinary upstream errors still respect ERROR_LOG_ENABLED")
			}
			if tc.wantQuota == 0 {
				assert.Empty(t, logs, "failed requests without billable data must refund")
				return
			}
			require.Len(t, logs, 1, "partial usage settles once despite the outer failure refund")
			assert.Equal(t, tc.wantQuota, logs[0].Quota)
			assert.Equal(t, 44, logs[0].PromptTokens)
			assert.Equal(t, tc.wantOutput, logs[0].CompletionTokens)
			var other map[string]any
			require.NoError(t, common.UnmarshalJsonStr(logs[0].Other, &other))
			assert.Equal(t, float64(100), other["cache_tokens"])
			assert.Equal(t, float64(20), other["cache_creation_tokens"])
			adminInfo, ok := other["admin_info"].(map[string]any)
			require.True(t, ok)
			if tc.wantOutput == 4 {
				assert.Equal(t, "billing-usage-anthropic-estimated", adminInfo["usage_billing_path"])
			} else {
				assert.Equal(t, "billing-usage-anthropic", adminInfo["usage_billing_path"])
			}
			stream, ok := other["stream_status"].(map[string]any)
			require.True(t, ok)
			if tc.drain {
				assert.Equal(t, true, stream["claude_drain_enabled"])
				assert.Equal(t, tc.marker != "", stream["client_disconnected"])
				assert.Equal(t, tc.drainTimeout, stream["drain_timeout"])
				assert.Equal(t, tc.successful, stream["upstream_completed"])
				if tc.marker != "" {
					assert.NotContains(t, rec.Body.String(), `"output_tokens":20`, "delivery stops at disconnect")
				}
			}
			if tc.successful {
				assert.Equal(t, "ok", stream["status"])
			} else {
				assert.Equal(t, "error", stream["status"])
				assert.Contains(t, logs[0].Content, "流式响应中断")
			}
			if tc.name == "upstream error after output" || tc.name == "truncated upstream after output" {
				assert.Contains(t, rec.Body.String(), "event: response.failed")
				assert.NotContains(t, rec.Body.String(), "event: response.completed")
				assert.True(t, strings.HasSuffix(rec.Body.String(), "\n\n"), "do not append an HTTP JSON error to SSE")
			}
		})
	}
}

func TestClaudeStreamDrainScopeAndValidation(t *testing.T) {
	for _, value := range []int{-1, 1801} {
		setting := fmt.Sprintf(`{"claude_stream_drain_enabled":true,"claude_stream_drain_timeout":%d}`, value)
		channel := model.Channel{Setting: &setting}
		require.Error(t, channel.ValidateSettings())
	}
	for _, tc := range []struct {
		name            string
		format          types.RelayFormat
		stream, enabled bool
	}{
		{"default off", types.RelayFormatClaude, true, false},
		{"nonstream Claude", types.RelayFormatClaude, false, true},
		{"OpenAI stream", types.RelayFormatOpenAI, true, true},
		{"Responses stream", types.RelayFormatOpenAIResponses, true, true},
		{"Gemini stream", types.RelayFormatGemini, true, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client, cancel := context.WithCancel(context.Background())
			defer cancel()
			canceled := make(chan struct{})
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, _ = io.Copy(io.Discard, r.Body)
				cancel()
				select {
				case <-r.Context().Done():
					close(canceled)
				case <-time.After(3 * time.Second):
					t.Error("unrelated request detached from client")
				}
			}))
			defer upstream.Close()
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil).WithContext(client)
			info := &relaycommon.RelayInfo{
				IsStream: tc.stream, DisablePing: true, RelayFormat: tc.format, RequestURLPath: "/v1/messages",
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType: constant.ChannelTypeNewAPI, ChannelBaseUrl: upstream.URL,
					ChannelSetting: dto.ChannelSettings{ClaudeStreamDrainEnabled: tc.enabled},
				},
			}
			_, err := relaychannel.DoApiRequest(&newapi.Adaptor{}, c, info, strings.NewReader(`{}`))
			require.Error(t, err)
			assert.Nil(t, info.ClaudeStreamDrain)
			select {
			case <-canceled:
			case <-time.After(3 * time.Second):
				t.Fatal("upstream did not receive cancellation")
			}
		})
	}
}
