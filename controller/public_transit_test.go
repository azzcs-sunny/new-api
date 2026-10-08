package controller

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
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
		model.PublicTransitCacheUsageSnapshot{
			AsOf: time.Date(2026, time.October, 2, 4, 0, 0, 0, time.UTC),
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
	assert.Equal(t, "2026-10-02T04:00:00Z", group.CacheUsage.UpdatedAt)
	assert.Equal(t, "total", group.CacheUsage.Total.Period)
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
	filtered := publicTransitCacheUsagePeriodFromModel("total", model.PublicTransitCacheUsage{InputTokens: 120, TotalInputTokens: 200, CacheReadTokens: 160, KnownRequests: 2, IncompleteRequests: 1})
	require.NotNil(t, filtered.CacheHitRate)
	require.NotNil(t, filtered.TotalInputTokens)
	assert.Equal(t, int64(200), *filtered.TotalInputTokens)
	assert.InDelta(t, 80.0, *filtered.CacheHitRate, 1e-12)
	assert.False(t, filtered.UsageComplete, "a valid subset has a rate but must disclose excluded records")
	filteredJSON, err := common.Marshal(filtered)
	require.NoError(t, err)
	assert.JSONEq(t, `{"period":"total","input_tokens":120,"cache_creation_tokens":0,"cache_read_tokens":160,"input_tokens_total":200,"cache_hit_rate":80,"usage_complete":false}`, string(filteredJSON))

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

// A blocked loader makes the non-blocking contract deterministic: the request
// must return before the test allows the database query to complete.
func readPublicTransitCache(t *testing.T, cache *publicTransitCacheUsageCache, groups []string, now time.Time) (model.PublicTransitCacheUsageSnapshot, bool) {
	t.Helper()
	type response struct {
		data      model.PublicTransitCacheUsageSnapshot
		available bool
	}
	returned := make(chan response, 1)
	go func() {
		data, available := cache.get(groups, now)
		returned <- response{data, available}
	}()
	select {
	case result := <-returned:
		return result.data, result.available
	case <-time.After(5 * time.Second):
		t.Fatal("snapshot request waited for the blocked cache query")
		return model.PublicTransitCacheUsageSnapshot{}, false
	}
}

func waitForPublicTransitRefresh(t *testing.T, done <-chan struct{}) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("cache refresh did not finish")
	}
}

func TestPublicTransitCacheUsageRefresh(t *testing.T) {
	for _, tc := range []struct {
		name              string
		warm, fail, panic bool
		loadErr           error
	}{
		{name: "cold cache"},
		{name: "expired cache", warm: true},
		{name: "failed cold refresh", fail: true},
		{name: "failed refresh retains stale usage", warm: true, fail: true},
		{name: "panic retains stale usage", warm: true, panic: true},
		{name: "busy database retains stale usage", warm: true, loadErr: model.ErrPublicTransitCacheUsageBusy},
		{name: "query timeout retains stale usage", warm: true, loadErr: context.DeadlineExceeded},
	} {
		t.Run(tc.name, func(t *testing.T) {
			now := time.Now()
			old := model.PublicTransitCacheUsageSnapshot{}
			if tc.warm {
				old.AsOf = now.Add(-time.Hour)
				old.Total = map[string]model.PublicTransitCacheUsage{"public": {TotalInputTokens: 100, CacheReadTokens: 80}}
			}
			fresh := model.PublicTransitCacheUsageSnapshot{AsOf: now, Total: map[string]model.PublicTransitCacheUsage{"public": {TotalInputTokens: 200, CacheReadTokens: 100}}}
			release := make(chan struct{})
			defer close(release)
			started := make(chan context.Context, 1)
			var calls atomic.Int32
			cache := &publicTransitCacheUsageCache{
				groupKey: "public", data: old, available: tc.warm, expiresAt: now.Add(-time.Second),
				load: func(ctx context.Context, at time.Time, groups []string) (model.PublicTransitCacheUsageSnapshot, error) {
					calls.Add(1)
					started <- ctx
					select {
					case <-release:
					case <-ctx.Done():
						return model.PublicTransitCacheUsageSnapshot{}, ctx.Err()
					}
					if tc.panic {
						panic("test database panic")
					}
					if tc.fail {
						return model.PublicTransitCacheUsageSnapshot{}, errors.New("test database failure")
					}
					if tc.loadErr != nil {
						return model.PublicTransitCacheUsageSnapshot{}, tc.loadErr
					}
					return fresh, nil
				},
			}
			data, available := readPublicTransitCache(t, cache, []string{"public"}, now)
			assert.Equal(t, tc.warm, available)
			assert.Equal(t, old, data)
			select {
			case ctx := <-started:
				_, hasDeadline := ctx.Deadline()
				assert.True(t, hasDeadline, "background database work must have a deadline")
			case <-time.After(5 * time.Second):
				t.Fatal("refresh did not start")
			}
			cache.Lock()
			done := cache.refreshing
			cache.Unlock()
			data, available = readPublicTransitCache(t, cache, []string{"public"}, now)
			assert.Equal(t, tc.warm, available)
			assert.Equal(t, old, data)
			assert.EqualValues(t, 1, calls.Load(), "concurrent requests must share one refresh")
			release <- struct{}{}
			waitForPublicTransitRefresh(t, done)
			data, available = readPublicTransitCache(t, cache, []string{"public"}, time.Now())
			if tc.fail || tc.panic || tc.loadErr != nil {
				assert.Equal(t, tc.warm, available)
				assert.Equal(t, old, data)
				data, available = readPublicTransitCache(t, cache, []string{"public"}, now.Add(5*time.Minute))
				assert.Equal(t, tc.warm, available)
				assert.Equal(t, old, data, "failed optional statistics must back off beyond a normal refresh interval")
			} else {
				assert.True(t, available)
				assert.Equal(t, fresh, data)
			}
			assert.EqualValues(t, 1, calls.Load(), "fresh data and failed refreshes must not immediately re-query")
		})
	}
}

func TestPublicTransitCacheUsageGroupChangeDuringRefresh(t *testing.T) {
	now := time.Now()
	release := make(chan struct{})
	defer close(release)
	started := make(chan []string, 2)
	cache := &publicTransitCacheUsageCache{
		load: func(ctx context.Context, at time.Time, groups []string) (model.PublicTransitCacheUsageSnapshot, error) {
			started <- groups
			select {
			case <-release:
			case <-ctx.Done():
				return model.PublicTransitCacheUsageSnapshot{}, ctx.Err()
			}
			return model.PublicTransitCacheUsageSnapshot{AsOf: at, Total: map[string]model.PublicTransitCacheUsage{groups[0]: {TotalInputTokens: 100}}}, nil
		},
	}
	_, available := readPublicTransitCache(t, cache, []string{"old"}, now)
	assert.False(t, available)
	select {
	case groups := <-started:
		assert.Equal(t, []string{"old"}, groups)
	case <-time.After(5 * time.Second):
		t.Fatal("old group refresh did not start")
	}
	cache.Lock()
	done := cache.refreshing
	cache.Unlock()
	_, available = readPublicTransitCache(t, cache, []string{"new"}, now)
	assert.False(t, available, "old group statistics must not be exposed for new groups")
	select {
	case <-started:
		t.Fatal("group change started an overlapping database scan")
	default:
	}
	release <- struct{}{}
	waitForPublicTransitRefresh(t, done)
	_, available = readPublicTransitCache(t, cache, []string{"new"}, now)
	assert.False(t, available, "the old in-flight result must be discarded")
	select {
	case groups := <-started:
		assert.Equal(t, []string{"new"}, groups)
	case <-time.After(5 * time.Second):
		t.Fatal("new group refresh did not start")
	}
	cache.Lock()
	done = cache.refreshing
	cache.Unlock()
	release <- struct{}{}
	waitForPublicTransitRefresh(t, done)
	data, available := readPublicTransitCache(t, cache, []string{"new"}, time.Now())
	assert.True(t, available)
	assert.Contains(t, data.Total, "new")
	assert.NotContains(t, data.Total, "old")
}

func TestPublicTransitCacheUsageResumesBatches(t *testing.T) {
	now := time.Now()
	published := model.PublicTransitCacheUsageSnapshot{AsOf: now.Add(-time.Hour), Total: map[string]model.PublicTransitCacheUsage{"public": {TotalInputTokens: 100}}}
	fresh := model.PublicTransitCacheUsageSnapshot{AsOf: now, Total: map[string]model.PublicTransitCacheUsage{"public": {TotalInputTokens: 200}}}
	secondBatch := make(chan context.Context, 1)
	release := make(chan struct{})
	defer close(release)
	var calls atomic.Int32
	var firstContext context.Context
	cache := &publicTransitCacheUsageCache{load: func(ctx context.Context, at time.Time, groups []string) (model.PublicTransitCacheUsageSnapshot, error) {
		if calls.Add(1) == 1 {
			firstContext = ctx
			return published, model.ErrPublicTransitCacheUsagePending
		}
		secondBatch <- ctx
		select {
		case <-release:
			return fresh, nil
		case <-ctx.Done():
			return model.PublicTransitCacheUsageSnapshot{}, ctx.Err()
		}
	}}
	_, available := readPublicTransitCache(t, cache, []string{"public"}, now)
	assert.False(t, available)
	select {
	case nextContext := <-secondBatch:
		assert.ErrorIs(t, firstContext.Err(), context.Canceled, "each batch must release its database context")
		assert.NoError(t, nextContext.Err(), "resuming must use a fresh deadline")
	case <-time.After(5 * time.Second):
		t.Fatal("worker did not continue its persisted backfill")
	}
	cache.Lock()
	done := cache.refreshing
	cache.Unlock()
	data, available := readPublicTransitCache(t, cache, []string{"public"}, now)
	assert.True(t, available, "restore the durable publication while backfill continues")
	assert.Equal(t, published, data)
	assert.EqualValues(t, 2, calls.Load(), "public requests must not start more workers")
	release <- struct{}{}
	waitForPublicTransitRefresh(t, done)
	data, available = readPublicTransitCache(t, cache, []string{"public"}, time.Now())
	assert.True(t, available)
	assert.Equal(t, fresh, data)
}
