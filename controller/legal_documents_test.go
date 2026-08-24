package controller

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestUpdateOptionStoresLegalDocumentUpdateTime(t *testing.T) {
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousMap := common.OptionMap
	previousRedisEnabled := common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}, &model.User{}, &model.Log{}))
	model.DB = db
	model.LOG_DB = db
	common.OptionMap = map[string]string{}
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.OptionMap = previousMap
		common.RedisEnabled = previousRedisEnabled
	})

	startedAt := time.Now().Unix()
	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(
		http.MethodPut,
		"/api/option/",
		strings.NewReader(`{"key":"legal.terms_of_service","value":"Configured terms"}`),
	)

	UpdateOption(context)

	assert.Equal(t, http.StatusOK, response.Code)
	assert.JSONEq(t, `{"success":true,"message":""}`, response.Body.String())
	var contentOption model.Option
	require.NoError(t, db.First(&contentOption, "key = ?", "legal.terms_of_service").Error)
	assert.Equal(t, "Configured terms", contentOption.Value)
	var updatedAtOption model.Option
	require.NoError(t, db.First(&updatedAtOption, "key = ?", "legal.terms_of_service_updated_at").Error)
	updatedAt, err := strconv.ParseInt(updatedAtOption.Value, 10, 64)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, updatedAt, startedAt)
	assert.LessOrEqual(t, updatedAt, time.Now().Unix())
}
