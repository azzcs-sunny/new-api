package model

import (
	"context"
	"errors"
	"fmt"
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

func collectPublicTransitUsage(t *testing.T, asOf time.Time, groups []string) PublicTransitCacheUsageSnapshot {
	t.Helper()
	for range 20 {
		require.NoError(t, DB.Model(&PublicTransitUsageState{}).Where("id = ?", 1).Update("next_run", int64(0)).Error)
		result, err := GetPublicTransitCacheUsage(context.Background(), asOf.Add(5*time.Minute), groups)
		if errors.Is(err, ErrPublicTransitCacheUsagePending) {
			continue
		}
		require.NoError(t, err)
		return result
	}
	t.Fatal("fixture backfill did not complete within its batch bound")
	return PublicTransitCacheUsageSnapshot{}
}

func TestGetPublicTransitCacheUsageAcrossDatabases(t *testing.T) {
	previousDB, previousLogDB := DB, LOG_DB
	previousMainType := common.MainDatabaseType()
	previousLogType := common.LogDatabaseType()
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.SetMainDatabaseType(previousMainType)
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

			DB, LOG_DB = db, db
			common.SetMainDatabaseType(common.DatabaseType(dialect))
			common.SetLogDatabaseType(common.DatabaseType(dialect))
			initCol()
			if dialect == "clickhouse" {
				require.NoError(t, db.Exec("DROP TABLE IF EXISTS logs").Error)
				require.NoError(t, db.Exec(clickHouseLogCreateTableSQL(0)).Error)
				DB, err = gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "rollups.db")), &gorm.Config{})
				require.NoError(t, err)
				mainSQL, err := DB.DB()
				require.NoError(t, err)
				t.Cleanup(func() { require.NoError(t, mainSQL.Close()) })
				common.SetMainDatabaseType(common.DatabaseTypeSQLite)
			} else {
				require.NoError(t, db.Migrator().DropTable(&Log{}))
				require.NoError(t, db.AutoMigrate(&Log{}))
			}
			t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable(&Log{})) })

			initCol()
			// Fresh install and repeated migration, followed by an upgrade of a
			// populated log schema. Log fields match release v1.0.0-rc.41.
			require.NoError(t, DB.Migrator().DropTable(&PublicTransitUsageState{}, &PublicTransitUsageHour{}))
			for range 2 {
				require.NoError(t, DB.AutoMigrate(&PublicTransitUsageState{}, &PublicTransitUsageHour{}))
			}
			require.NoError(t, DB.Migrator().DropTable(&PublicTransitUsageState{}, &PublicTransitUsageHour{}))
			t.Cleanup(func() {
				require.NoError(t, DB.Migrator().DropTable(&PublicTransitUsageState{}, &PublicTransitUsageHour{}))
			})
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
			// A shared rollup/publication can exceed MySQL TEXT's 64 KiB limit
			// when many groups are configured; keep that real storage boundary covered.
			for i := range 400 {
				logs = append(logs, Log{CreatedAt: now.Add(-3 * time.Hour).Unix(), Type: LogTypeConsume, Group: fmt.Sprintf("large-rollup-%03d", i), PromptTokens: 1, Other: `{"usage_semantic":"openai"}`})
			}
			require.NoError(t, db.Create(&logs).Error)
			for range 2 {
				require.NoError(t, DB.AutoMigrate(&PublicTransitUsageState{}, &PublicTransitUsageHour{}))
			}
			var preserved []Log
			require.NoError(t, db.Order("created_at, id").Find(&preserved).Error)
			assert.ElementsMatch(t, logs, preserved, "adding statistics tables must preserve released log data")
			if dialect != "clickhouse" {
				assert.True(t, db.Migrator().HasIndex(&Log{}, "idx_created_at_id"))
			}

			snapshot := collectPublicTransitUsage(t, now, []string{"public"})
			assert.Equal(t, now, snapshot.AsOf)
			last24Hours := snapshot.Last24Hours
			assert.Equal(t, last24Hours, snapshot.Last7Days)
			assert.Equal(t, int64(50), last24Hours["public"].InputTokens)
			assert.Equal(t, int64(10), last24Hours["public"].CacheCreationTokens)
			assert.Equal(t, int64(40), last24Hours["public"].CacheReadTokens)

			total := snapshot.Total
			assert.Equal(t, int64(550), total["public"].InputTokens)
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
				{"legacy-oai-responses", 154218, `{"admin_info":{"usage_billing_path":"upstream"},"cache_tokens":153088,"request_conversion":["OpenAI Responses"],"request_path":"/v1/responses"}`, 154218, 153088, 0, 0},
				{"legacy-deepseek", 157251, `{"admin_info":{"usage_billing_path":"upstream"},"cache_tokens":156160,"request_conversion":["OpenAI Compatible"],"request_path":"/v1/chat/completions"}`, 157251, 156160, 0, 0},
				{"legacy-converted-gemini", 100, `{"cache_tokens":80,"request_conversion":["OpenAI Compatible","Google Gemini"]}`, 100, 80, 0, 0},
				{"legacy-converted-claude", 10, `{"cache_tokens":80,"request_conversion":["OpenAI Compatible","Claude Messages"]}`, 90, 80, 0, 0},
				{"legacy-converted-openai", 100, `{"cache_tokens":80,"request_conversion":["Claude Messages","OpenAI Compatible"]}`, 100, 80, 0, 0},
				{"legacy-split-before-protocol", 10, `{"cache_tokens":80,"cache_creation_tokens_5m":10,"request_conversion":["OpenAI Compatible"]}`, 100, 80, 10, 0},
				{"legacy-claude-before-protocol", 10, `{"claude":true,"cache_tokens":80,"request_conversion":["OpenAI Responses"]}`, 90, 80, 0, 0},
				{"semantic-before-conversion", 10, `{"usage_semantic":"anthropic","cache_tokens":80,"request_conversion":["OpenAI Compatible"]}`, 90, 80, 0, 0},
				{"billing-path-before-conversion", 10, `{"admin_info":{"usage_billing_path":"billing-usage-anthropic"},"cache_tokens":80,"request_conversion":["OpenAI Responses"]}`, 90, 80, 0, 0},
				{"legacy-unknown-final-protocol", 100, `{"cache_tokens":80,"request_conversion":["OpenAI Compatible","unknown"],"request_path":"/v1/chat/completions"}`, 0, 80, 0, 1},
				{"legacy-request-path-only", 100, `{"cache_tokens":80,"request_path":"/v1/responses"}`, 0, 80, 0, 1},
				{"legacy-invalid-cache", 10, `{"cache_tokens":80,"request_conversion":["OpenAI Compatible"]}`, 0, 80, 0, 1},
				{"overlapping-prefixes", 100, `{"usage_semantic":"openai","cache_tokens":80,"cache_write_tokens":90}`, 100, 80, 90, 0},
				{"unknown", 100, `{"cache_tokens":80}`, 0, 80, 0, 1},
				{"invalid", 100, `not-json`, 0, 0, 0, 1},
				{"null-total", 100, `{"usage_semantic":"openai","input_tokens_total":null,"cache_tokens":80}`, 100, 80, 0, 0},
				{"invalid-total", 10, `{"input_tokens_total":10,"cache_tokens":80}`, 0, 80, 0, 1},
			}
			groups := []string{"mixed", "empty", "windows", "expired"}
			fixtures := make([]Log, 0, len(cases)+2)
			for _, tc := range cases {
				groups = append(groups, tc.name)
				fixtures = append(fixtures, Log{CreatedAt: now.Add(-time.Second).Unix(), Type: LogTypeConsume, Group: tc.name, PromptTokens: tc.prompt, Other: tc.other})
			}
			fixtures = append(fixtures,
				Log{CreatedAt: now.Add(-time.Second).Unix(), Type: LogTypeConsume, Group: "mixed", PromptTokens: 100, Other: `{"usage_semantic":"openai","cache_tokens":80}`},
				Log{CreatedAt: now.Add(-time.Second).Unix(), Type: LogTypeConsume, Group: "mixed", PromptTokens: 20, Other: `{"claude":true,"cache_tokens":80}`})
			for _, boundary := range []struct {
				at     time.Time
				tokens int
			}{
				{now.Add(-time.Second), 1},
				{now.Add(-24 * time.Hour), 2},
				{now.Add(-24*time.Hour - time.Second), 4},
				{now.Add(-7 * 24 * time.Hour), 8},
				{now.Add(-7*24*time.Hour - time.Second), 16},
				{now, 32},
				{now.Add(-30 * 24 * time.Hour), 64},
				{now.Add(-30*24*time.Hour - time.Second), 128},
				{now.Add(-30*24*time.Hour + time.Second), 256},
			} {
				fixtures = append(fixtures, Log{CreatedAt: boundary.at.Unix(), Type: LogTypeConsume, Group: "windows", PromptTokens: boundary.tokens, Other: common.MapToJsonStr(map[string]any{"usage_semantic": "openai", "cache_tokens": boundary.tokens})})
			}
			fixtures = append(fixtures,
				Log{CreatedAt: now.Add(-31 * 24 * time.Hour).Unix(), Type: LogTypeConsume, Group: "windows", PromptTokens: 512, Other: `{"cache_creation_tokens":512}`},
				Log{CreatedAt: now.Add(-31 * 24 * time.Hour).Unix(), Type: LogTypeConsume, Group: "expired", PromptTokens: 512, Other: `{"usage_semantic":"openai","cache_tokens":512}`})
			require.NoError(t, db.Create(&fixtures).Error)
			require.NoError(t, DB.Where("id = ?", 1).Delete(&PublicTransitUsageState{}).Error)
			snapshot = collectPublicTransitUsage(t, now, groups)
			usage := snapshot.Total
			for _, tc := range cases {
				t.Run(tc.name, func(t *testing.T) {
					expected := PublicTransitCacheUsage{Group: tc.name, InputTokens: int64(tc.prompt), TotalInputTokens: tc.total, CacheReadTokens: tc.read, CacheCreationTokens: tc.write, KnownRequests: 1}
					if tc.incomplete != 0 {
						expected = PublicTransitCacheUsage{Group: tc.name, IncompleteRequests: tc.incomplete}
					}
					assert.Equal(t, expected, usage[tc.name])
				})
			}
			assert.Equal(t, PublicTransitCacheUsage{Group: "mixed", InputTokens: 120, TotalInputTokens: 200, CacheReadTokens: 160, KnownRequests: 2}, usage["mixed"])
			assert.NotContains(t, usage, "empty")
			assert.NotContains(t, usage, "private")
			assert.NotContains(t, usage, "expired")
			assert.Equal(t, int64(3), snapshot.Last24Hours["windows"].TotalInputTokens)
			assert.Equal(t, int64(15), snapshot.Last7Days["windows"].TotalInputTokens)
			assert.Equal(t, int64(351), snapshot.Total["windows"].TotalInputTokens)
			assert.Equal(t, int64(3), snapshot.Last24Hours["windows"].CacheReadTokens)
			assert.Equal(t, int64(15), snapshot.Last7Days["windows"].CacheReadTokens)
			assert.Equal(t, int64(351), snapshot.Total["windows"].CacheReadTokens)
			assert.Equal(t, int64(351), snapshot.Total["windows"].InputTokens)
			assert.Zero(t, snapshot.Total["windows"].CacheCreationTokens)
			assert.Zero(t, snapshot.Total["windows"].IncompleteRequests, "expired logs must not make current statistics incomplete")
			ctx, cancel := context.WithCancel(context.Background())
			cancel()
			_, err = GetPublicTransitCacheUsage(ctx, now.Add(5*time.Minute), groups)
			require.ErrorIs(t, err, context.Canceled)

			// Optional statistics must yield the last connection to business work.
			sqlDB.SetMaxOpenConns(1)
			_, err = GetPublicTransitCacheUsage(context.Background(), now.Add(5*time.Minute), groups)
			require.ErrorIs(t, err, ErrPublicTransitCacheUsageBusy)
			var businessResult int
			require.NoError(t, sqlDB.QueryRow("SELECT 1").Scan(&businessResult))
			assert.Equal(t, 1, businessResult)

			sqlDB.SetMaxOpenConns(2)
			businessConnection, err := sqlDB.Conn(context.Background())
			require.NoError(t, err)
			t.Cleanup(func() { _ = businessConnection.Close() })
			_, err = GetPublicTransitCacheUsage(context.Background(), now.Add(5*time.Minute), groups)
			require.ErrorIs(t, err, ErrPublicTransitCacheUsageBusy)
			require.NoError(t, sqlDB.QueryRow("SELECT 1").Scan(&businessResult))
			require.NoError(t, businessConnection.Close())
			recovered, err := GetPublicTransitCacheUsage(context.Background(), now.Add(5*time.Minute), groups)
			require.NoError(t, err)
			assert.Equal(t, snapshot, recovered, "statistics resume after business capacity is available")
			// Force multiple batches, all sharing a timestamp. ClickHouse must
			// retain duplicate request IDs at the page boundary as well.
			require.NoError(t, DB.Where("id = ?", 1).Delete(&PublicTransitUsageState{}).Error)
			batchLogs := make([]Log, publicTransitUsageBatchSize+3)
			for i := range batchLogs {
				batchLogs[i] = Log{CreatedAt: now.Add(-time.Minute).Unix(), Type: LogTypeConsume, Group: "resume", RequestId: fmt.Sprintf("resume-%04d", i), PromptTokens: 1, Other: `{"usage_semantic":"openai","cache_tokens":1}`}
			}
			var preceding int64
			require.NoError(t, db.Model(&Log{}).Where("created_at >= ? AND created_at < ?", now.Add(-30*24*time.Hour).Unix(), now.Add(-time.Minute).Unix()).Count(&preceding).Error)
			boundary := publicTransitUsageBatchSize - int(preceding)%publicTransitUsageBatchSize
			batchLogs[boundary].RequestId = batchLogs[boundary-1].RequestId
			require.NoError(t, db.Create(&batchLogs).Error)
			partial, err := GetPublicTransitCacheUsage(context.Background(), now.Add(5*time.Minute), []string{"resume"})
			require.ErrorIs(t, err, ErrPublicTransitCacheUsagePending)
			assert.True(t, partial.AsOf.IsZero(), "partial backfill must not be published")
			var checkpoint PublicTransitUsageState
			require.NoError(t, DB.First(&checkpoint, 1).Error)
			assert.False(t, checkpoint.Complete)
			// Simulate a different instance holding the lease: no log read and
			// no checkpoint changes, then recover an expired lease after restart.
			require.NoError(t, DB.Model(&checkpoint).Updates(map[string]any{"lease": "another-instance", "lease_until": time.Now().Add(time.Minute).UnixNano(), "next_run": int64(0)}).Error)
			_, err = GetPublicTransitCacheUsage(context.Background(), now.Add(5*time.Minute), []string{"resume"})
			require.ErrorIs(t, err, ErrPublicTransitCacheUsageBusy)
			require.NoError(t, DB.Model(&checkpoint).Update("lease_until", int64(0)).Error)
			// A transaction failure after rollup writes must roll back both
			// the hour and cursor, so retrying cannot double count a batch.
			injected := errors.New("injected checkpoint failure")
			require.NoError(t, DB.Callback().Update().Before("gorm:update").Register("transit_checkpoint_failure", func(tx *gorm.DB) {
				if values, ok := tx.Statement.Dest.(map[string]any); ok {
					if _, exists := values["cursor_time"]; exists {
						tx.AddError(injected)
					}
				}
			}))
			_, err = GetPublicTransitCacheUsage(context.Background(), now.Add(5*time.Minute), []string{"resume"})
			require.ErrorIs(t, err, injected)
			require.NoError(t, DB.Callback().Update().Remove("transit_checkpoint_failure"))
			var afterFailure PublicTransitUsageState
			require.NoError(t, DB.First(&afterFailure, 1).Error)
			assert.Equal(t, checkpoint.CursorTime, afterFailure.CursorTime)
			assert.Equal(t, checkpoint.CursorID, afterFailure.CursorID)
			assert.Equal(t, checkpoint.CursorRequestID, afterFailure.CursorRequestID)
			assert.Greater(t, afterFailure.NextRun, time.Now().Add(14*time.Minute).UnixNano(), "failure backoff must be shared across instances")
			// A lease lost after reading logs must fence out the old worker's
			// entire write transaction, even if its SQL query succeeded.
			require.NoError(t, DB.Model(&PublicTransitUsageState{}).Where("id = ?", 1).Update("next_run", int64(0)).Error)
			stealLease := func(tx *gorm.DB) {
				if !tx.DryRun {
					require.NoError(t, DB.Model(&PublicTransitUsageState{}).Where("id = ?", 1).Update("lease", "replacement-worker").Error)
				}
			}
			require.NoError(t, db.Callback().Query().After("gorm:query").Register("transit_lease_lost", func(tx *gorm.DB) {
				if tx.Statement.Table == "logs" {
					stealLease(tx)
				}
			}))
			require.NoError(t, db.Callback().Row().After("gorm:row").Register("transit_lease_lost", stealLease))
			_, err = GetPublicTransitCacheUsage(context.Background(), now.Add(5*time.Minute), []string{"resume"})
			require.ErrorIs(t, err, ErrPublicTransitCacheUsageBusy)
			require.NoError(t, db.Callback().Query().Remove("transit_lease_lost"))
			require.NoError(t, db.Callback().Row().Remove("transit_lease_lost"))
			require.NoError(t, DB.Model(&PublicTransitUsageState{}).Where("id = ?", 1).Update("lease_until", int64(0)).Error)
			resumed := collectPublicTransitUsage(t, now, []string{"resume", "windows"})
			assert.Equal(t, int64(len(batchLogs)), resumed.Total["resume"].TotalInputTokens)
			assert.Equal(t, int64(351), resumed.Total["windows"].InputTokens)
			// Reopening a session and adding public groups reads publication;
			// it neither loses progress nor replays the raw log batches.
			DB = DB.Session(&gorm.Session{NewDB: true})
			reloaded, err := GetPublicTransitCacheUsage(context.Background(), now.Add(5*time.Minute), []string{"resume"})
			require.NoError(t, err)
			assert.Equal(t, resumed.Total["resume"], reloaded.Total["resume"])
			assert.NotContains(t, reloaded.Total, "windows")
			// A valid publication must not touch logs at all, even for a newly
			// public group. Reject every raw-log read to make this deterministic.
			noLogRead := func(tx *gorm.DB) { tx.AddError(errors.New("unexpected raw log read")) }
			require.NoError(t, db.Callback().Query().Before("gorm:query").Register("transit_no_log_read", func(tx *gorm.DB) {
				if tx.Statement.Table == "logs" {
					noLogRead(tx)
				}
			}))
			require.NoError(t, db.Callback().Row().Before("gorm:row").Register("transit_no_log_read", noLogRead))
			cached, err := GetPublicTransitCacheUsage(context.Background(), now.Add(5*time.Minute), []string{"large-rollup-399"})
			require.NoError(t, err)
			assert.Equal(t, int64(1), cached.Total["large-rollup-399"].InputTokens)
			require.NoError(t, db.Callback().Query().Remove("transit_no_log_read"))
			require.NoError(t, db.Callback().Row().Remove("transit_no_log_read"))

			// Advance an hour and include a late log in the repair window.
			late := Log{CreatedAt: now.Add(-time.Hour).Unix(), Type: LogTypeConsume, Group: "resume", RequestId: "late", PromptTokens: 7, Other: `{"usage_semantic":"openai"}`}
			require.NoError(t, db.Create(&late).Error)
			rebuildGroups := []string{"resume", "windows", "legacy-oai-responses", "legacy-deepseek"}
			advanced := collectPublicTransitUsage(t, now.Add(time.Hour), rebuildGroups)
			assert.Equal(t, now.Add(time.Hour), advanced.AsOf)
			assert.Equal(t, int64(len(batchLogs)+7), advanced.Total["resume"].InputTokens)
			assert.Equal(t, int64(63), advanced.Total["windows"].InputTokens, "30-day boundary must expire and the next hour must enter")
			var expiredHours int64
			require.NoError(t, DB.Model(&PublicTransitUsageHour{}).Where("hour < ?", now.Add(time.Hour-30*24*time.Hour).Unix()).Count(&expiredHours).Error)
			assert.Zero(t, expiredHours)
			for range 2 {
				require.NoError(t, DB.AutoMigrate(&PublicTransitUsageState{}, &PublicTransitUsageHour{}))
			}
			afterMigration, err := GetPublicTransitCacheUsage(context.Background(), now.Add(time.Hour+5*time.Minute), rebuildGroups)
			require.NoError(t, err)
			assert.Equal(t, advanced, afterMigration, "repeated startup migration must preserve published statistics")
			// Rebuild both pre-filtering and pre-protocol-inference publications,
			// including partially completed backfills, from the unchanged raw logs.
			for _, old := range []struct {
				version  int
				complete bool
			}{{0, true}, {0, false}, {1, true}, {1, false}} {
				legacy := advanced
				legacy.RollupVersion = old.version
				encoded, err := common.Marshal(legacy)
				require.NoError(t, err)
				require.NoError(t, DB.Model(&PublicTransitUsageState{}).Where("id = ?", 1).Updates(map[string]any{"published": string(encoded), "complete": old.complete}).Error)
				corrupt := map[string]PublicTransitCacheUsage{"resume": {Group: "resume", InputTokens: 999999, CacheReadTokens: 888888, IncompleteRequests: 1}}
				encoded, err = common.Marshal(corrupt)
				require.NoError(t, err)
				require.NoError(t, DB.Model(&PublicTransitUsageHour{}).Where("hour = ?", now.Add(-time.Hour).Unix()).Update("usage", string(encoded)).Error)
				rebuilt := collectPublicTransitUsage(t, now.Add(time.Hour), rebuildGroups)
				assert.Equal(t, advanced, rebuilt, "old hourly values must not contaminate filtered statistics")
			}

			require.Error(t, DB.Create(&PublicTransitUsageState{ID: 1}).Error, "singleton state primary key must remain enforced")

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
