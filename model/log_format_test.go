package model

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/clickhouse"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestTaskLogDetailsAcrossDatabases(t *testing.T) {
	previousDB, previousLogDB := DB, LOG_DB
	mainType, logType := common.MainDatabaseType(), common.LogDatabaseType()
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(mainType, logType)
		initCol()
	})
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(filepath.Join(t.TempDir(), "tasks.db"))
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN is not configured")
				}
				driver = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN is not configured")
				}
				driver = postgres.Open(dsn)
			}
			db, err := gorm.Open(driver, &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
			versionQuery := "SELECT version()"
			if dialect == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			var version string
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("%s version: %s", dialect, version)
			DB = db
			common.SetMainDatabaseType(common.DatabaseType(dialect))
			require.NoError(t, db.AutoMigrate(&Task{}, &Log{}))
			t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable(&Task{}, &Log{})) })

			for _, separateLogs := range []bool{false, true} {
				t.Run(map[bool]string{false: "shared", true: "separate-logs"}[separateLogs], func(t *testing.T) {
					LOG_DB = db
					common.SetLogDatabaseType(common.DatabaseType(dialect))
					if separateLogs {
						LOG_DB, err = gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "logs.db")), &gorm.Config{})
						require.NoError(t, err)
						logSQL, err := LOG_DB.DB()
						require.NoError(t, err)
						t.Cleanup(func() { require.NoError(t, logSQL.Close()) })
						common.SetLogDatabaseType(common.DatabaseTypeSQLite)
						require.NoError(t, LOG_DB.AutoMigrate(&Log{}))
					}
					initCol()
					require.NoError(t, DB.Where("1 = 1").Delete(&Task{}).Error)
					require.NoError(t, LOG_DB.Where("1 = 1").Delete(&Log{}).Error)
					tasks := []Task{
						{TaskID: "task-priced", UserId: 7, Status: TaskStatusSuccess, SubmitTime: 100, StartTime: 120, FinishTime: 142,
							PrivateData: TaskPrivateData{Key: "private-credential", BillingContext: &TaskBillingContext{ModelPrice: 0.09, GroupRatio: 2, OtherRatios: map[string]float64{"seconds": 8, "resolution": 1.5}}}},
						{TaskID: "task-priced-480p", UserId: 7, Status: TaskStatusSuccess, SubmitTime: 100, FinishTime: 142,
							PrivateData: TaskPrivateData{BillingContext: &TaskBillingContext{ModelPrice: 0.09, OtherRatios: map[string]float64{"seconds": 8, "resolution": 1}}}},
						{TaskID: "task-priced-1080p", UserId: 7, Status: TaskStatusSuccess, SubmitTime: 100, FinishTime: 142,
							PrivateData: TaskPrivateData{BillingContext: &TaskBillingContext{ModelPrice: 0.09, OtherRatios: map[string]float64{"seconds": 8, "resolution": 2}}}},
						{TaskID: "task-fixed", UserId: 7, Status: TaskStatusFailure, SubmitTime: 100, FinishTime: 112,
							PrivateData: TaskPrivateData{BillingContext: &TaskBillingContext{ModelPrice: 0.09, PerCallBilling: true, OtherRatios: map[string]float64{"seconds": 8, "resolution": 2}}}},
						{TaskID: "task-pending", UserId: 7, Status: TaskStatusInProgress, SubmitTime: 100},
						{TaskID: "task-missing-time", UserId: 7, Status: TaskStatusSuccess, SubmitTime: 100},
					}
					require.NoError(t, DB.Create(&tasks).Error)
					for _, id := range []string{"task-priced", "task-priced-480p", "task-priced-1080p", "task-fixed", "task-pending", "task-missing-time", "task-deleted"} {
						other := common.MapToJsonStr(map[string]any{"is_task": true, "task_id": id, "model_price": 0.09, "admin_info": map[string]any{"existing": true}})
						require.NoError(t, LOG_DB.Create(&Log{UserId: 7, TokenId: 70, Type: LogTypeConsume, UseTime: 1, Quota: 1080, Other: other}).Error)
					}
					require.NoError(t, LOG_DB.Create(&Log{UserId: 8, TokenId: 80, Type: LogTypeConsume, Other: `{"is_task":true,"task_id":"task-priced"}`}).Error)

					for _, audience := range []string{"admin", "user", "token"} {
						t.Run(audience, func(t *testing.T) {
							var logs []*Log
							var err error
							switch audience {
							case "admin":
								logs, _, err = GetAllLogs(LogTypeConsume, 0, 0, "", "", "", 0, 20, 0, "", "", "", nil)
							case "user":
								logs, _, err = GetUserLogs(7, LogTypeConsume, 0, 0, "", "", 0, 20, "", "", "", nil)
							case "token":
								logs, err = GetLogByTokenId(70)
							}
							require.NoError(t, err)
							expectedCount := 7
							if audience == "admin" {
								expectedCount++
							}
							require.Len(t, logs, expectedCount)
							for _, log := range logs {
								other, err := common.StrToMap(log.Other)
								require.NoError(t, err)
								assert.NotContains(t, log.Other, "private-credential")
								if log.UserId == 8 || other["task_id"] == "task-deleted" {
									assert.NotContains(t, other, "task_timing")
									assert.NotContains(t, other, "task_billing")
									continue
								}
								assert.Equal(t, 1080, log.Quota, "display enrichment must not change the charge")
								assert.Equal(t, 1, log.UseTime, "submission time remains available separately")
								if audience != "admin" {
									assert.NotContains(t, other, "admin_info")
								}
								timing, ok := other["task_timing"].(map[string]any)
								require.True(t, ok)
								switch other["task_id"] {
								case "task-priced", "task-priced-480p", "task-priced-1080p":
									assert.Equal(t, float64(42), timing["duration_seconds"], "includes queue time")
									billing, ok := other["task_billing"].(map[string]any)
									require.True(t, ok)
									assert.Equal(t, "second", billing["billing_unit"])
									prices := map[string]float64{"task-priced": 0.135, "task-priced-480p": 0.09, "task-priced-1080p": 0.18}
									assert.Equal(t, prices[other["task_id"].(string)], billing["unit_price"])
									assert.Equal(t, float64(8), billing["quantity"])
								case "task-fixed":
									assert.Equal(t, float64(12), timing["duration_seconds"])
									billing, ok := other["task_billing"].(map[string]any)
									require.True(t, ok)
									assert.Equal(t, "request", billing["billing_unit"])
									assert.Equal(t, 0.09, billing["unit_price"])
								case "task-pending":
									assert.Equal(t, "IN_PROGRESS", timing["status"])
									assert.Contains(t, timing, "duration_seconds")
								case "task-missing-time":
									assert.NotContains(t, timing, "duration_seconds")
								}
							}
						})
					}
					var stored Log
					require.NoError(t, LOG_DB.Where("user_id = ?", 7).First(&stored).Error)
					assert.NotContains(t, stored.Other, "task_timing", "enrichment must not rewrite historical logs")
				})
			}
		})
	}
}

func TestGetPublicTransitCacheUsageAcrossDatabases(t *testing.T) {
	previousLogDB := LOG_DB
	previousLogType := common.LogDatabaseType()
	t.Cleanup(func() {
		LOG_DB = previousLogDB
		common.SetLogDatabaseType(previousLogType)
		initCol()
	})

	for _, dialect := range []string{"sqlite", "mysql", "postgres", "clickhouse"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(filepath.Join(t.TempDir(), "public-transit.db"))
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN is not configured")
				}
				driver = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN is not configured")
				}
				driver = postgres.Open(dsn)
			case "clickhouse":
				dsn := os.Getenv("TEST_CLICKHOUSE_DSN")
				if dsn == "" {
					t.Skip("TEST_CLICKHOUSE_DSN is not configured")
				}
				driver = clickhouse.Open(dsn)
			}

			db, err := gorm.Open(driver, &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })

			LOG_DB = db
			common.SetLogDatabaseType(common.DatabaseType(dialect))
			initCol()
			if dialect == "clickhouse" {
				require.NoError(t, db.Exec("DROP TABLE IF EXISTS logs").Error)
				require.NoError(t, db.Exec(`CREATE TABLE logs (
					id Int64, user_id Int64, created_at Int64, type Int64, content String,
					username String, token_name String, model_name String, quota Int64,
					prompt_tokens Int64, completion_tokens Int64, use_time Int64,
					is_stream UInt8, channel_id Int64, token_id Int64, `+"`group`"+` String,
					ip String, request_id String, upstream_request_id String, other String
				) ENGINE = MergeTree ORDER BY (created_at, id)`).Error)
			} else {
				require.NoError(t, db.Migrator().DropTable(&Log{}))
				require.NoError(t, db.AutoMigrate(&Log{}))
			}
			t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable(&Log{})) })

			versionQuery := "SELECT version()"
			if dialect == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			var version string
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("%s version: %s", dialect, version)

			now := time.Date(2026, time.October, 2, 12, 0, 0, 0, time.UTC)
			logs := []Log{
				{CreatedAt: now.Add(-time.Hour).Unix(), Type: LogTypeConsume, Group: "public", PromptTokens: 50, Other: `{"claude":true,"cache_tokens":40,"cache_creation_tokens":10}`},
				{CreatedAt: now.Add(-2 * time.Hour).Unix(), Type: LogTypeConsume, Group: "public", PromptTokens: 5, Other: `not-json`},
				{CreatedAt: now.Add(-8 * 24 * time.Hour).Unix(), Type: LogTypeConsume, Group: "public", PromptTokens: 500, Other: `{"usage_semantic":"anthropic","cache_tokens":400,"cache_creation_tokens":100}`},
				{CreatedAt: now.Add(-time.Hour).Unix(), Type: LogTypeError, Group: "public", PromptTokens: 999, Other: `{"cache_tokens":999}`},
				{CreatedAt: now.Add(-time.Hour).Unix(), Type: LogTypeConsume, Group: "private", PromptTokens: 999, Other: `{"cache_tokens":999}`},
			}
			require.NoError(t, db.Create(&logs).Error)

			last24Hours, err := GetPublicTransitCacheUsage(now.Add(-24*time.Hour).Unix(), []string{"public"})
			require.NoError(t, err)
			assert.Equal(t, int64(55), last24Hours["public"].InputTokens)
			assert.Equal(t, int64(10), last24Hours["public"].CacheCreationTokens)
			assert.Equal(t, int64(40), last24Hours["public"].CacheReadTokens)

			total, err := GetPublicTransitCacheUsage(0, []string{"public"})
			require.NoError(t, err)
			assert.Equal(t, int64(555), total["public"].InputTokens)
			assert.Equal(t, int64(110), total["public"].CacheCreationTokens)
			assert.Equal(t, int64(440), total["public"].CacheReadTokens)
			assert.Equal(t, int64(1100), total["public"].TotalInputTokens)
			assert.Equal(t, int64(1), total["public"].IncompleteRequests)

			cases := []struct {
				name                           string
				prompt                         int
				other                          string
				total, read, write, incomplete int64
			}{
				{"openai", 100, `{"usage_semantic":"openai","cache_tokens":80}`, 100, 80, 0, 0},
				{"gemini", 100, `{"usage_semantic":"gemini","cache_tokens":80}`, 100, 80, 0, 0},
				{"claude", 10, `{"claude":true,"cache_tokens":80,"cache_creation_tokens":10}`, 100, 80, 10, 0},
				{"split", 10, `{"usage_semantic":"anthropic","cache_tokens":80,"cache_creation_tokens":3,"cache_creation_tokens_5m":4,"cache_creation_tokens_1h":6}`, 100, 80, 10, 0},
				{"creation-larger", 10, `{"claude":true,"cache_tokens":80,"cache_creation_tokens":10,"cache_creation_tokens_5m":4}`, 100, 80, 10, 0},
				{"normalized-write", 10, `{"claude":true,"cache_tokens":80,"cache_write_tokens":10,"cache_creation_tokens":99}`, 100, 80, 10, 0},
				{"explicit-total", 10, `{"claude":true,"input_tokens_total":100,"cache_tokens":80,"cache_write_tokens":10}`, 100, 80, 10, 0},
				{"explicit-zero", 100, `{"input_tokens_total":0,"cache_write_tokens":0,"cache_creation_tokens":10}`, 0, 0, 0, 0},
				{"path-openai", 100, `{"admin_info":{"usage_billing_path":"billing-usage-openai"},"cache_tokens":80}`, 100, 80, 0, 0},
				{"path-before-protocol", 100, `{"claude":true,"admin_info":{"usage_billing_path":"billing-usage-openai"},"cache_tokens":80}`, 100, 80, 0, 0},
				{"path-gemini", 100, `{"admin_info":{"usage_billing_path":"billing-usage-gemini"},"cache_tokens":80}`, 100, 80, 0, 0},
				{"path-claude", 20, `{"admin_info":{"usage_billing_path":"billing-usage-anthropic"},"cache_tokens":80}`, 100, 80, 0, 0},
				{"semantic-precedence", 100, `{"usage_semantic":"openai","claude":true,"cache_tokens":80}`, 100, 80, 0, 0},
				{"overlapping-prefixes", 100, `{"usage_semantic":"openai","cache_tokens":80,"cache_write_tokens":90}`, 100, 80, 90, 0},
				{"unknown", 100, `{"cache_tokens":80}`, 0, 80, 0, 1},
				{"invalid", 100, `not-json`, 0, 0, 0, 1},
				{"null-total", 100, `{"usage_semantic":"openai","input_tokens_total":null,"cache_tokens":80}`, 100, 80, 0, 0},
				{"invalid-total", 10, `{"input_tokens_total":10,"cache_tokens":80}`, 0, 80, 0, 1},
			}
			groups := []string{"mixed", "empty"}
			fixtures := make([]Log, 0, len(cases)+2)
			for _, tc := range cases {
				groups = append(groups, tc.name)
				fixtures = append(fixtures, Log{CreatedAt: now.Unix(), Type: LogTypeConsume, Group: tc.name, PromptTokens: tc.prompt, Other: tc.other})
			}
			fixtures = append(fixtures,
				Log{CreatedAt: now.Unix(), Type: LogTypeConsume, Group: "mixed", PromptTokens: 100, Other: `{"usage_semantic":"openai","cache_tokens":80}`},
				Log{CreatedAt: now.Unix(), Type: LogTypeConsume, Group: "mixed", PromptTokens: 20, Other: `{"claude":true,"cache_tokens":80}`})
			require.NoError(t, db.Create(&fixtures).Error)
			usage, err := GetPublicTransitCacheUsage(now.Add(-24*time.Hour).Unix(), groups)
			require.NoError(t, err)
			for _, tc := range cases {
				t.Run(tc.name, func(t *testing.T) {
					assert.Equal(t, PublicTransitCacheUsage{Group: tc.name, InputTokens: int64(tc.prompt), TotalInputTokens: tc.total, CacheReadTokens: tc.read, CacheCreationTokens: tc.write, IncompleteRequests: tc.incomplete}, usage[tc.name])
				})
			}
			assert.Equal(t, PublicTransitCacheUsage{Group: "mixed", InputTokens: 120, TotalInputTokens: 200, CacheReadTokens: 160}, usage["mixed"])
			assert.NotContains(t, usage, "empty")
			assert.NotContains(t, usage, "private")
		})
	}
}

// TestFormatUserLogsStripsQuotaSaturation verifies the admin-only quota
// saturation marker (nested under other.admin_info) is removed for non-admin
// log views, since formatUserLogs strips the whole admin_info object.
func TestFormatUserLogsStripsQuotaSaturation(t *testing.T) {
	other := common.MapToJsonStr(map[string]any{
		"model_price": 0.004,
		"admin_info": map[string]any{
			"quota_saturation": map[string]any{
				"op":      "QuotaFromDecimal",
				"kind":    "overflow",
				"clamped": common.MaxQuota,
			},
		},
	})
	logs := []*Log{{Other: other}}

	formatUserLogs(logs, 0)

	parsed, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	_, hasAdminInfo := parsed["admin_info"]
	require.False(t, hasAdminInfo, "admin_info (and nested quota_saturation) must be stripped for non-admin views")
	// Non-admin billing fields remain visible.
	require.Contains(t, parsed, "model_price")
}

func TestTaskPluginLogVisibilityIsRoleSeparated(t *testing.T) {
	other := common.MapToJsonStr(map[string]any{
		"model_price": 1.25,
		"admin_info": map[string]any{
			"task_plugin": map[string]any{
				"key":     "document-parser",
				"name":    "Document Parser",
				"version": "1.2.3",
			},
		},
		"root_info": map[string]any{
			"upstream_task_id": "upstream-private",
			"task_plugin": map[string]any{
				"generation": 42,
			},
		},
	})

	t.Run("user", func(t *testing.T) {
		logs := []*Log{{Other: other}}
		formatUserLogs(logs, 0)

		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.NotContains(t, parsed, "admin_info")
		assert.NotContains(t, parsed, "root_info")
		assert.Equal(t, 1.25, parsed["model_price"])
	})

	t.Run("admin", func(t *testing.T) {
		logs := []*Log{{Other: other}}
		FormatAdminLogs(logs)

		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Contains(t, parsed, "admin_info")
		assert.NotContains(t, parsed, "root_info")
	})

	t.Run("root", func(t *testing.T) {
		logs := []*Log{{Other: other}}
		FormatRootLogs(logs)

		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Contains(t, parsed, "admin_info")
		assert.Contains(t, parsed, "root_info")
	})
}

func TestLegacyLogOtherVisibilityIsRoleSeparated(t *testing.T) {
	other := common.MapToJsonStr(map[string]any{
		"request_path":  "/v1/chat/completions",
		"channel_id":    202,
		"channel_name":  "legacy-secret-channel",
		"channel_type":  1,
		"reject_reason": "legacy-policy-rejection",
		"admin_info": map[string]any{
			"existing_admin_field": "preserved",
		},
		"root_info": map[string]any{
			"upstream_request_id": "upstream-private",
		},
		"audit_info": map[string]any{
			"method": "POST",
		},
	})

	t.Run("user", func(t *testing.T) {
		logs := []*Log{{
			Id:          99,
			ChannelId:   77,
			ChannelName: "resolved-secret-channel",
			Other:       other,
		}}

		formatUserLogs(logs, 10)

		assert.Equal(t, 11, logs[0].Id)
		assert.Equal(t, 77, logs[0].ChannelId)
		assert.Empty(t, logs[0].ChannelName)
		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Equal(t, "/v1/chat/completions", parsed["request_path"])
		for _, key := range []string{
			"channel_id",
			"channel_name",
			"channel_type",
			"reject_reason",
			"admin_info",
			"root_info",
			"audit_info",
		} {
			assert.NotContains(t, parsed, key)
		}
	})

	t.Run("admin", func(t *testing.T) {
		logs := []*Log{{Other: other}}

		FormatAdminLogs(logs)

		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Equal(t, "legacy-secret-channel", parsed["channel_name"])
		assert.NotContains(t, parsed, "reject_reason")
		assert.NotContains(t, parsed, "root_info")
		assert.Contains(t, parsed, "audit_info")
		adminInfo, ok := parsed["admin_info"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "preserved", adminInfo["existing_admin_field"])
		assert.Equal(t, "legacy-policy-rejection", adminInfo["reject_reason"])
	})

	t.Run("root", func(t *testing.T) {
		logs := []*Log{{Other: other}}

		FormatRootLogs(logs)

		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Equal(t, "legacy-secret-channel", parsed["channel_name"])
		assert.NotContains(t, parsed, "reject_reason")
		assert.Contains(t, parsed, "root_info")
		assert.Contains(t, parsed, "audit_info")
		adminInfo, ok := parsed["admin_info"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "preserved", adminInfo["existing_admin_field"])
		assert.Equal(t, "legacy-policy-rejection", adminInfo["reject_reason"])
	})
}

func TestLegacyRejectReasonDoesNotOverrideScopedValue(t *testing.T) {
	other := common.MapToJsonStr(map[string]any{
		"reject_reason": "legacy-value",
		"admin_info": map[string]any{
			"reject_reason": "scoped-value",
		},
	})
	logs := []*Log{{Other: other}}

	FormatRootLogs(logs)

	parsed, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	assert.NotContains(t, parsed, "reject_reason")
	adminInfo, ok := parsed["admin_info"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "scoped-value", adminInfo["reject_reason"])
}

func TestLegacyRejectReasonHandlesNullAdminInfo(t *testing.T) {
	logs := []*Log{{Other: `{"reject_reason":"legacy-value","admin_info":null}`}}

	FormatAdminLogs(logs)

	parsed, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	assert.NotContains(t, parsed, "reject_reason")
	adminInfo, ok := parsed["admin_info"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "legacy-value", adminInfo["reject_reason"])
}

func TestLogFormattingPreservesLargeIntegerLexemes(t *testing.T) {
	const other = `{"public_id":9007199254740993,"admin_info":{"admin_id":9007199254740995},"root_info":{"generation":18446744073709551615}}`

	t.Run("user", func(t *testing.T) {
		logs := []*Log{{Other: other}}

		formatUserLogs(logs, 0)

		assert.Contains(t, logs[0].Other, `"public_id":9007199254740993`)
		assert.NotContains(t, logs[0].Other, "admin_id")
		assert.NotContains(t, logs[0].Other, "generation")
	})

	t.Run("admin", func(t *testing.T) {
		logs := []*Log{{Other: other}}

		FormatAdminLogs(logs)

		assert.Contains(t, logs[0].Other, `"public_id":9007199254740993`)
		assert.Contains(t, logs[0].Other, `"admin_id":9007199254740995`)
		assert.NotContains(t, logs[0].Other, "generation")
	})

	t.Run("root", func(t *testing.T) {
		logs := []*Log{{Other: other}}

		FormatRootLogs(logs)

		assert.Equal(t, other, logs[0].Other)
	})

	t.Run("unprivileged", func(t *testing.T) {
		const unprivileged = `{"public_id":9007199254740993,"model_price":0.004}`

		userLogs := []*Log{{Other: unprivileged}}
		formatUserLogs(userLogs, 0)
		assert.Equal(t, unprivileged, userLogs[0].Other)

		adminLogs := []*Log{{Other: unprivileged}}
		FormatAdminLogs(adminLogs)
		assert.Equal(t, unprivileged, adminLogs[0].Other)
	})
}
