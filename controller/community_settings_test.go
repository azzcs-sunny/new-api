package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestCommunitySettingsSaveReloadAndClear(t *testing.T) {
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMap, previousRedis := common.OptionMap, common.RedisEnabled
	settings := operation_setting.GetGeneralSetting()
	previousSettings := *settings
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.OptionMap, common.RedisEnabled = previousMap, previousRedis
		*settings = previousSettings
	})
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}, &model.User{}, &model.Log{}))
	model.DB, model.LOG_DB = db, db
	common.OptionMap, common.RedisEnabled = map[string]string{}, false

	values := map[string]string{
		"infinite_canvas_url": "https://canvas.example.com/",
		"qq_group_url":        "https://qm.qq.com/q/test", "qq_group_name": "Example QQ",
		"qq_group_number": "123456789", "telegram_url": "https://t.me/example",
		"telegram_name": "Example Telegram", "customer_service_qq": "987654321",
	}
	for _, clear := range []bool{false, true} {
		for key, value := range values {
			if clear {
				value = ""
			}
			body, err := common.Marshal(OptionUpdateRequest{Key: "general_setting." + key, Value: "  " + value + "  "})
			require.NoError(t, err)
			response := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(response)
			ctx.Request = httptest.NewRequest(http.MethodPut, "/api/option/", strings.NewReader(string(body)))
			UpdateOption(ctx)
			require.JSONEq(t, `{"success":true,"message":""}`, response.Body.String())
			var stored model.Option
			require.NoError(t, db.Where("key = ?", "general_setting."+key).First(&stored).Error)
			assert.Equal(t, value, stored.Value)
		}
		var stored []model.Option
		require.NoError(t, db.Find(&stored).Error)
		reloaded := map[string]string{}
		for _, option := range stored {
			reloaded[option.Key] = option.Value
		}
		require.NoError(t, config.GlobalConfig.LoadFromDB(reloaded))
		response := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(response)
		ctx.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)
		GetStatus(ctx)
		var payload struct {
			Success bool           `json:"success"`
			Data    map[string]any `json:"data"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
		require.True(t, payload.Success)
		for key, value := range values {
			if clear {
				value = ""
			}
			assert.Equal(t, value, payload.Data[key], key)
		}
	}
}

func TestCommunitySettingsRejectUnsafeLinks(t *testing.T) {
	for _, key := range []string{"general_setting.qq_group_url", "general_setting.telegram_url", "general_setting.infinite_canvas_url"} {
		for _, value := range []string{"javascript:alert(1)", "//t.me/example", "https://user:password@t.me/example", "not-a-link", "https://"} {
			t.Run(key+"/"+value, func(t *testing.T) {
				body, err := common.Marshal(OptionUpdateRequest{Key: key, Value: value})
				require.NoError(t, err)
				response := httptest.NewRecorder()
				ctx, _ := gin.CreateTestContext(response)
				ctx.Request = httptest.NewRequest(http.MethodPut, "/api/option/", strings.NewReader(string(body)))
				UpdateOption(ctx)
				var payload struct {
					Success bool `json:"success"`
				}
				require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
				assert.False(t, payload.Success)
			})
		}
	}
}
