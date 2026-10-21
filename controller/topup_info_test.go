package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"

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

func TestGetTopUpInfoFiltersCardCodeLinkByAccountGroup(t *testing.T) {
	gin.SetMode(gin.TestMode)
	general := operation_setting.GetGeneralSetting()
	originalGroups, originalLink := general.TopUpLinkGroups, common.TopUpLink
	t.Cleanup(func() {
		general.TopUpLinkGroups, common.TopUpLink = originalGroups, originalLink
	})

	for _, tc := range []struct {
		name   string
		groups []string
		group  string
		link   string
		want   string
	}{
		{name: "default empty selection hides link", group: "default", link: "https://store.example.com"},
		{name: "explicit empty selection hides link", groups: []string{}, group: "vip", link: "https://store.example.com"},
		{name: "selected group sees link", groups: []string{"default", "vip"}, group: "vip", link: " https://store.example.com ", want: "https://store.example.com"},
		{name: "unselected group cannot see link", groups: []string{"vip"}, group: "default", link: "https://store.example.com"},
		{name: "missing account group hides link", groups: []string{""}, link: "https://store.example.com"},
		{name: "group matching is exact", groups: []string{"vip"}, group: "VIP", link: "https://store.example.com"},
		{name: "selected group still needs link", groups: []string{"vip"}, group: "vip"},
		{name: "whitespace link stays hidden", groups: []string{"vip"}, group: "vip", link: " \t "},
	} {
		t.Run(tc.name, func(t *testing.T) {
			general.TopUpLinkGroups, common.TopUpLink = tc.groups, tc.link
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/topup/info?group=vip", nil)
			ctx.Set("group", tc.group)
			ctx.Set("role", common.RoleRootUser)

			GetTopUpInfo(ctx)

			require.Equal(t, http.StatusOK, recorder.Code)
			var response struct {
				Success bool `json:"success"`
				Data    struct {
					TopupLink string `json:"topup_link"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.True(t, response.Success)
			assert.Equal(t, tc.want, response.Data.TopupLink)
		})
	}
}

func TestCardCodeGroupSelectionConfigRoundTrip(t *testing.T) {
	defaults, err := config.ConfigToMap(operation_setting.GetGeneralSetting())
	require.NoError(t, err)
	assert.Equal(t, "[]", defaults["topup_link_groups"])

	var loaded operation_setting.GeneralSetting
	manager := config.NewConfigManager()
	manager.Register("general_setting", &loaded)
	require.NoError(t, manager.LoadFromDB(map[string]string{
		"general_setting.topup_link_groups": `["default","vip"]`,
	}))
	assert.Equal(t, []string{"default", "vip"}, loaded.TopUpLinkGroups)
	values := make(map[string]string)
	require.NoError(t, manager.SaveToDB(func(key, value string) error {
		values[key] = value
		return nil
	}))
	assert.JSONEq(t, `["default","vip"]`, values["general_setting.topup_link_groups"])
	require.NoError(t, manager.LoadFromDB(map[string]string{
		"general_setting.topup_link_groups": `[]`,
	}))
	assert.Empty(t, loaded.TopUpLinkGroups)
}
