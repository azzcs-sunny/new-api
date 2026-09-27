package model

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
