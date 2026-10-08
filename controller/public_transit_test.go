package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildPublicTransitSnapshotProjectsPublicPricing(t *testing.T) {
	cacheRead := 0.0
	cacheWrite := 1.25
	previousPrice := operation_setting.Price
	previousMinTopUp := operation_setting.MinTopUp
	previousServerAddress := system_setting.ServerAddress
	operation_setting.Price = 5
	operation_setting.MinTopUp = 10
	system_setting.ServerAddress = "https://console.example.com/"
	t.Cleanup(func() {
		operation_setting.Price = previousPrice
		operation_setting.MinTopUp = previousMinTopUp
		system_setting.ServerAddress = previousServerAddress
	})

	snapshot := buildPublicTransitSnapshot(
		"https://api.example.com",
		[]model.Pricing{
			{
				ModelName:              "token-model",
				VendorID:               1,
				QuotaType:              0,
				ModelRatio:             1.5,
				CompletionRatio:        4,
				CacheRatio:             &cacheRead,
				CreateCacheRatio:       &cacheWrite,
				EnableGroup:            []string{"public"},
				BillingMode:            "tiered_expr",
				BillingExpr:            "p * 3 + c * 12",
				SupportedEndpointTypes: []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse},
			},
			{
				ModelName:       "fixed-model",
				VendorID:        2,
				QuotaType:       1,
				ModelPrice:      0.25,
				EnableGroup:     []string{"all"},
				CompletionRatio: 1,
			},
		},
		[]model.PricingVendor{{ID: 1, Name: "OpenAI"}, {ID: 2, Name: "Google"}},
		map[string]string{"public": "Public"},
		map[string]float64{"hidden": 9, "public": 0.5, "private": 2},
		publicTransitCacheUsageSnapshot{
			Last24Hours: map[string]model.PublicTransitCacheUsage{
				"public": {InputTokens: 50, TotalInputTokens: 100, CacheCreationTokens: 10, CacheReadTokens: 40},
			},
			Last7Days: map[string]model.PublicTransitCacheUsage{
				"public": {InputTokens: 500, TotalInputTokens: 1000, CacheCreationTokens: 100, CacheReadTokens: 400},
			},
			Total: map[string]model.PublicTransitCacheUsage{
				"public": {InputTokens: 5000, TotalInputTokens: 10000, CacheCreationTokens: 1000, CacheReadTokens: 4000},
			},
		},
		true,
		time.Date(2026, time.October, 2, 12, 0, 0, 0, time.FixedZone("CST", 8*60*60)),
	)

	assert.Equal(t, publicTransitSchemaVersion, snapshot.SchemaVersion)
	assert.Equal(t, "2026-10-02T04:00:00Z", snapshot.GeneratedAt)
	assert.Equal(t, "https://console.example.com", snapshot.Site.WebsiteURL)
	assert.Equal(t, "https://api.example.com/v1", snapshot.Site.APIBase)
	require.NotNil(t, snapshot.Billing.BalancePerCNY)
	assert.InDelta(t, 0.2, *snapshot.Billing.BalancePerCNY, 1e-12)
	require.NotNil(t, snapshot.Billing.MinimumTopUp)
	assert.Equal(t, 50.0, *snapshot.Billing.MinimumTopUp)

	require.Len(t, snapshot.Groups, 1)
	group := snapshot.Groups[0]
	assert.Equal(t, "public", group.Name)
	assert.Equal(t, "mixed", group.Platform)
	assert.Equal(t, "mixed_or_unknown", group.SubscriptionType)
	assert.Equal(t, 0.5, group.RateMultiplier)
	assert.False(t, group.IsExclusive)
	require.NotNil(t, group.CacheUsage)
	assert.Equal(t, int64(50), group.CacheUsage.Last24Hours.InputTokens)
	assert.Equal(t, int64(10), group.CacheUsage.Last24Hours.CacheCreationTokens)
	assert.Equal(t, int64(40), group.CacheUsage.Last24Hours.CacheReadTokens)
	require.NotNil(t, group.CacheUsage.Last24Hours.CacheHitRate)
	assert.InDelta(t, 40.0, *group.CacheUsage.Last24Hours.CacheHitRate, 1e-12)
	require.NotNil(t, group.CacheUsage.Last24Hours.TotalInputTokens)
	assert.Equal(t, int64(100), *group.CacheUsage.Last24Hours.TotalInputTokens)
	assert.True(t, group.CacheUsage.Last24Hours.UsageComplete)

	incomplete := publicTransitCacheUsagePeriodFromModel("total", model.PublicTransitCacheUsage{IncompleteRequests: 1})
	assert.Nil(t, incomplete.CacheHitRate)
	assert.Nil(t, incomplete.TotalInputTokens)
	assert.False(t, incomplete.UsageComplete)
	empty := publicTransitCacheUsagePeriodFromModel("last_24h", model.PublicTransitCacheUsage{})
	require.NotNil(t, empty.CacheHitRate)
	assert.Zero(t, *empty.CacheHitRate)
	mixed := publicTransitCacheUsagePeriodFromModel("total", model.PublicTransitCacheUsage{InputTokens: 120, TotalInputTokens: 200, CacheReadTokens: 160})
	require.NotNil(t, mixed.CacheHitRate)
	assert.InDelta(t, 80.0, *mixed.CacheHitRate, 1e-12)
	encoded, err := common.Marshal(incomplete)
	require.NoError(t, err)
	assert.Contains(t, string(encoded), `"cache_hit_rate":null`)
	assert.Contains(t, string(encoded), `"usage_complete":false`)
	require.Len(t, group.Models, 2)
	assert.Equal(t, "fixed-model", group.Models[0].StandardModel)
	assert.Equal(t, "token-model", group.Models[1].StandardModel)

	tokenModel := group.Models[1]
	assert.Equal(t, "tiered_expr", tokenModel.BillingMode)
	assert.Equal(t, "p * 3 + c * 12", tokenModel.BillingExpr)
	assert.Equal(t, []string{"openai", "openai-response"}, tokenModel.SupportedProtocols)
	require.NotNil(t, tokenModel.Price.InputUSDPerToken)
	require.NotNil(t, tokenModel.Price.OutputUSDPerToken)
	require.NotNil(t, tokenModel.Price.CacheReadUSDPerToken)
	require.NotNil(t, tokenModel.Price.CacheWriteUSDPerToken)
	assert.InDelta(t, 0.000003, *tokenModel.Price.InputUSDPerToken, 1e-12)
	assert.InDelta(t, 0.000012, *tokenModel.Price.OutputUSDPerToken, 1e-12)
	assert.Zero(t, *tokenModel.Price.CacheReadUSDPerToken)
	assert.InDelta(t, 0.00000375, *tokenModel.Price.CacheWriteUSDPerToken, 1e-12)

	fixedModel := group.Models[0]
	assert.Equal(t, "per_request", fixedModel.BillingMode)
	require.NotNil(t, fixedModel.Price.PerRequestUSD)
	assert.Equal(t, 0.25, *fixedModel.Price.PerRequestUSD)
	assert.Empty(t, snapshot.Monitoring)
	assert.True(t, snapshot.Cache.Supported)
	assert.Equal(t, []string{"token-model"}, snapshot.Cache.Models)
	assert.True(t, snapshot.Completeness.HasCacheUsage)
	assert.True(t, snapshot.Completeness.HasSourceDisclosure)
	assert.Equal(t, "https://api.example.com/.well-known/ai-transit.json", snapshot.Endpoints.DiscoveryURL)
	assert.Equal(t, "https://api.example.com/api/public/transit/v1/snapshot", snapshot.Endpoints.SnapshotURL)
	require.Len(t, snapshot.Models, 2)
	require.Len(t, snapshot.ServiceGroups, 1)
	assert.Equal(t, "Public", snapshot.ServiceGroups[0].DisplayName)
}

func TestGetAITransitDiscoveryUsesPublicRequestOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousServerAddress := system_setting.ServerAddress
	system_setting.ServerAddress = "https://console.example.com/"
	t.Cleanup(func() { system_setting.ServerAddress = previousServerAddress })

	engine := gin.New()
	engine.GET("/.well-known/ai-transit.json", GetAITransitDiscovery)
	request := httptest.NewRequest(http.MethodGet, "http://internal/.well-known/ai-transit.json", nil)
	request.Host = "api.example.com"
	request.Header.Set("X-Forwarded-Proto", "https")
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
	var discovery publicTransitDiscovery
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &discovery))
	assert.Equal(t, publicTransitSchemaVersion, discovery.SchemaVersion)
	assert.Equal(t, "new_api", discovery.System)
	assert.Equal(t, "https://api.example.com/api/public/transit/v1/snapshot", discovery.SnapshotURL)
	assert.Equal(t, "https://console.example.com", discovery.HomepageURL)
	assert.Equal(t, publicTransitCacheSeconds, discovery.CacheTTLSeconds)
	_, err := time.Parse(time.RFC3339, discovery.GeneratedAt)
	require.NoError(t, err)
}
