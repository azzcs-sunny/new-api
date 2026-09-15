package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetTopUpInfoReturnsAuthenticatedUserTopupGroupRatio(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalRatios := common.TopupGroupRatio2JSONString()
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"default":1,"vip":1.25}`))
	t.Cleanup(func() {
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(originalRatios))
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/topup/info", nil)
	ctx.Set("group", "vip")

	GetTopUpInfo(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			TopupGroupRatio float64 `json:"topup_group_ratio"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Equal(t, 1.25, response.Data.TopupGroupRatio)
}
