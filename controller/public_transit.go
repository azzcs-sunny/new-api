package controller

import (
	"fmt"
	"math"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

const (
	publicTransitSchemaVersion = "ai-transit.v1"
	publicTransitCacheSeconds  = 300
)

type publicTransitDiscovery struct {
	SchemaVersion   string `json:"schema_version"`
	System          string `json:"system"`
	SnapshotURL     string `json:"snapshot_url"`
	HomepageURL     string `json:"homepage_url"`
	GeneratedAt     string `json:"generated_at"`
	CacheTTLSeconds int    `json:"cache_ttl_seconds"`
}

type publicTransitSnapshot struct {
	SchemaVersion       string                           `json:"schema_version"`
	System              string                           `json:"system"`
	GeneratedAt         string                           `json:"generated_at"`
	CacheTTLSeconds     int                              `json:"cache_ttl_seconds"`
	Site                publicTransitSite                `json:"site"`
	Billing             publicTransitBilling             `json:"billing"`
	Groups              []publicTransitGroup             `json:"groups"`
	Monitoring          []publicTransitMonitoring        `json:"monitoring"`
	Cache               publicTransitCache               `json:"cache"`
	Completeness        publicTransitCompleteness        `json:"completeness"`
	Disclosure          publicTransitDisclosure          `json:"disclosure"`
	Endpoints           publicTransitEndpoints           `json:"endpoints"`
	Limits              publicTransitLimits              `json:"limits"`
	Models              []publicTransitCatalogModel      `json:"models"`
	PromotionalGroups   []publicTransitPromotionalGroup  `json:"promotional_groups"`
	ServiceAvailability publicTransitServiceAvailability `json:"service_availability"`
	ServiceGroups       []publicTransitServiceGroup      `json:"service_groups"`
	Station             publicTransitStation             `json:"station"`
	Testing             publicTransitTesting             `json:"testing"`
}

type publicTransitSite struct {
	Name         string `json:"name"`
	WebsiteURL   string `json:"website_url"`
	APIBase      string `json:"api_base"`
	SystemType   string `json:"system_type"`
	SupportURL   string `json:"support_url,omitempty"`
	SupportLabel string `json:"support_label,omitempty"`
}

type publicTransitBilling struct {
	Currency                 string                     `json:"currency"`
	CreditCurrency           string                     `json:"credit_currency"`
	RechargeRatio            string                     `json:"recharge_ratio,omitempty"`
	RechargeMultiplier       *float64                   `json:"recharge_multiplier,omitempty"`
	RechargeMultiplierUnit   string                     `json:"recharge_multiplier_unit,omitempty"`
	BalancePerCNY            *float64                   `json:"balance_per_cny,omitempty"`
	MinimumTopUp             *float64                   `json:"minimum_top_up,omitempty"`
	ModelBasisPrice          string                     `json:"model_basis_price"`
	ModelPriceUnit           string                     `json:"model_price_unit"`
	StandardizedPriceVersion string                     `json:"standardized_price_version"`
	CurrencySymbol           string                     `json:"currency_symbol,omitempty"`
	QuotaPerUnit             float64                    `json:"quota_per_unit"`
	MinTopUp                 *float64                   `json:"min_topup,omitempty"`
	TopUpURL                 string                     `json:"topup_url,omitempty"`
	BalanceValidity          string                     `json:"balance_validity"`
	RefundPolicy             *publicTransitRefundPolicy `json:"refund_policy,omitempty"`
}

type publicTransitRefundPolicy struct {
	Status     string `json:"status"`
	ContactURL string `json:"contact_url,omitempty"`
}

type publicTransitGroup struct {
	Name             string                   `json:"name"`
	Description      string                   `json:"description,omitempty"`
	Platform         string                   `json:"platform"`
	SubscriptionType string                   `json:"subscription_type"`
	RateMultiplier   float64                  `json:"rate_multiplier"`
	IsExclusive      bool                     `json:"is_exclusive"`
	CacheUsage       *publicTransitCacheUsage `json:"cache_usage,omitempty"`
	Models           []publicTransitModel     `json:"models"`
}

type publicTransitCacheUsage struct {
	Last24Hours publicTransitCacheUsagePeriod `json:"last_24h"`
	Last7Days   publicTransitCacheUsagePeriod `json:"last_7d"`
	Total       publicTransitCacheUsagePeriod `json:"total"`
}

type publicTransitCacheUsagePeriod struct {
	Period              string   `json:"period"`
	InputTokens         int64    `json:"input_tokens"`
	CacheCreationTokens int64    `json:"cache_creation_tokens"`
	CacheReadTokens     int64    `json:"cache_read_tokens"`
	TotalInputTokens    *int64   `json:"input_tokens_total"`
	CacheHitRate        *float64 `json:"cache_hit_rate"`
	UsageComplete       bool     `json:"usage_complete"`
}

type publicTransitModel struct {
	StandardModel      string                   `json:"standard_model"`
	RawModel           string                   `json:"raw_model"`
	Platform           string                   `json:"platform"`
	BillingMode        string                   `json:"billing_mode"`
	PriceSource        string                   `json:"price_source"`
	CatalogSource      string                   `json:"catalog_source"`
	Price              publicTransitPrice       `json:"price"`
	Source             publicTransitModelSource `json:"source"`
	BillingExpr        string                   `json:"billing_expr,omitempty"`
	PricingVersion     string                   `json:"pricing_version,omitempty"`
	SupportedProtocols []string                 `json:"supported_protocols"`
}

type publicTransitModelSource struct {
	UpstreamType    string `json:"upstream_type"`
	AccountPoolType string `json:"account_pool_type"`
	Disclosure      string `json:"disclosure"`
}

type publicTransitPrice struct {
	InputUSDPerToken      *float64 `json:"input_usd_per_token,omitempty"`
	OutputUSDPerToken     *float64 `json:"output_usd_per_token,omitempty"`
	CacheReadUSDPerToken  *float64 `json:"cache_read_usd_per_token,omitempty"`
	CacheWriteUSDPerToken *float64 `json:"cache_write_usd_per_token,omitempty"`
	ImageUSDPerToken      *float64 `json:"image_output_usd_per_token,omitempty"`
	PerRequestUSD         *float64 `json:"per_request_usd,omitempty"`
}

type publicTransitCatalogModel struct {
	ModelName              string   `json:"model_name"`
	VendorID               int      `json:"vendor_id,omitempty"`
	QuotaType              int      `json:"quota_type"`
	ModelRatio             float64  `json:"model_ratio"`
	ModelPrice             float64  `json:"model_price"`
	CompletionRatio        float64  `json:"completion_ratio"`
	CacheRatio             *float64 `json:"cache_ratio,omitempty"`
	CreateCacheRatio       *float64 `json:"create_cache_ratio,omitempty"`
	EnableGroups           []string `json:"enable_groups"`
	SupportedEndpointTypes []string `json:"supported_endpoint_types"`
	BillingMode            string   `json:"billing_mode,omitempty"`
	BillingExpr            string   `json:"billing_expr,omitempty"`
	PricingVersion         string   `json:"pricing_version,omitempty"`
}

type publicTransitCache struct {
	Supported bool     `json:"supported"`
	Models    []string `json:"models"`
	WriteUnit string   `json:"write_unit"`
	ReadUnit  string   `json:"read_unit"`
}

type publicTransitCompleteness struct {
	HasRechargeRatio    bool `json:"has_recharge_ratio"`
	HasGroupMultipliers bool `json:"has_group_multipliers"`
	HasModelPricing     bool `json:"has_model_pricing"`
	HasMonitoring       bool `json:"has_monitoring"`
	HasCacheUsage       bool `json:"has_cache_usage"`
	HasSourceDisclosure bool `json:"has_source_disclosure"`
}

type publicTransitDisclosure struct {
	UpstreamType    string `json:"upstream_type"`
	AccountPoolType string `json:"account_pool_type"`
	IsMixed         bool   `json:"is_mixed"`
	IsReverse       bool   `json:"is_reverse"`
	Note            string `json:"note"`
}

type publicTransitEndpoints struct {
	DiscoveryURL  string `json:"discovery_url"`
	SnapshotURL   string `json:"snapshot_url"`
	PublicPageURL string `json:"public_page_url,omitempty"`
}

type publicTransitLimits struct {
	ModelRequestRateLimitEnabled bool `json:"model_request_rate_limit_enabled"`
	DefaultWindowMinutes         int  `json:"default_window_minutes"`
	DefaultRequestCount          int  `json:"default_request_count"`
}

type publicTransitServiceGroup struct {
	Name        string  `json:"name"`
	DisplayName string  `json:"display_name"`
	Ratio       float64 `json:"ratio"`
	SourceType  string  `json:"source_type"`
}

type publicTransitServiceAvailability struct {
	IncludedInServiceScore  bool                             `json:"included_in_service_score"`
	WindowHours             int                              `json:"window_hours"`
	MinSamplesForPercentage int                              `json:"min_samples_for_percentage"`
	IncludedGroups          []string                         `json:"included_groups"`
	Groups                  []publicTransitAvailabilityGroup `json:"groups"`
}

type publicTransitAvailabilityGroup struct{}
type publicTransitMonitoring struct{}
type publicTransitPromotionalGroup struct{}

type publicTransitStation struct {
	Name        string `json:"name"`
	HomepageURL string `json:"homepage_url"`
	PriceURL    string `json:"price_url"`
	MonitorURL  string `json:"monitor_url,omitempty"`
	SupportURL  string `json:"support_url,omitempty"`
	SystemType  string `json:"system_type"`
}

type publicTransitTesting struct {
	PublicTestKeyExposed bool   `json:"public_test_key_exposed"`
	ReviewerAccess       string `json:"reviewer_access"`
	UserTrial            string `json:"user_trial"`
}

type publicTransitCacheUsageSnapshot struct {
	Last24Hours map[string]model.PublicTransitCacheUsage
	Last7Days   map[string]model.PublicTransitCacheUsage
	Total       map[string]model.PublicTransitCacheUsage
}

var publicTransitCacheUsageState struct {
	sync.Mutex
	groupKey  string
	expiresAt time.Time
	data      publicTransitCacheUsageSnapshot
	available bool
}

func GetAITransitDiscovery(c *gin.Context) {
	baseURL := publicTransitBaseURL(c)
	homepageURL := strings.TrimRight(system_setting.ServerAddress, "/")
	if homepageURL == "" {
		homepageURL = baseURL
	}

	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, publicTransitDiscovery{
		SchemaVersion:   publicTransitSchemaVersion,
		System:          "new_api",
		SnapshotURL:     baseURL + "/api/public/transit/v1/snapshot",
		HomepageURL:     homepageURL,
		GeneratedAt:     time.Now().UTC().Format(time.RFC3339),
		CacheTTLSeconds: publicTransitCacheSeconds,
	})
}

func GetPublicTransitSnapshot(c *gin.Context) {
	baseURL := publicTransitBaseURL(c)
	usableGroups := service.GetUserUsableGroups("")
	groupRatios := ratio_setting.GetGroupRatioCopy()
	groupNames := publicTransitGroupNames(usableGroups, groupRatios)
	cacheUsage, cacheUsageAvailable := getPublicTransitCacheUsage(groupNames, time.Now())
	snapshot := buildPublicTransitSnapshot(
		baseURL,
		model.GetPricing(),
		model.GetVendors(),
		usableGroups,
		groupRatios,
		cacheUsage,
		cacheUsageAvailable,
		time.Now(),
	)

	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, snapshot)
}

func buildPublicTransitSnapshot(
	baseURL string,
	pricing []model.Pricing,
	vendors []model.PricingVendor,
	usableGroups map[string]string,
	groupRatios map[string]float64,
	cacheUsage publicTransitCacheUsageSnapshot,
	cacheUsageAvailable bool,
	now time.Time,
) publicTransitSnapshot {
	vendorNames := make(map[int]string, len(vendors))
	for _, vendor := range vendors {
		vendorNames[vendor.ID] = strings.ToLower(strings.TrimSpace(vendor.Name))
	}

	groupNames := publicTransitGroupNames(usableGroups, groupRatios)
	groups := make(map[string]*publicTransitGroup, len(groupNames))
	seenModels := make(map[string]map[string]struct{}, len(groupNames))
	serviceGroups := make([]publicTransitServiceGroup, 0, len(groupNames))
	for _, groupName := range groupNames {
		description := usableGroups[groupName]
		displayName := description
		if displayName == "" {
			displayName = groupName
		}
		groups[groupName] = &publicTransitGroup{
			Name:             groupName,
			Description:      description,
			Platform:         "unknown",
			SubscriptionType: "mixed_or_unknown",
			RateMultiplier:   groupRatios[groupName],
			IsExclusive:      false,
			Models:           make([]publicTransitModel, 0),
		}
		if cacheUsageAvailable {
			groups[groupName].CacheUsage = buildPublicTransitGroupCacheUsage(groupName, cacheUsage)
		}
		serviceGroups = append(serviceGroups, publicTransitServiceGroup{
			Name:        groupName,
			DisplayName: displayName,
			Ratio:       groupRatios[groupName],
			SourceType:  "mixed_or_unknown",
		})
		seenModels[groupName] = make(map[string]struct{})
	}

	pricing = filterPricingByUsableGroups(pricing, usableGroups)
	catalogModels := make([]publicTransitCatalogModel, 0, len(pricing))
	cacheModels := make(map[string]struct{})
	for _, item := range pricing {
		targetGroups := item.EnableGroup
		if slices.Contains(item.EnableGroup, "all") {
			targetGroups = groupNames
		}

		billingMode := item.BillingMode
		if billingMode == "" {
			if item.QuotaType == 1 {
				billingMode = "per_request"
			} else {
				billingMode = "token"
			}
		}

		platform := item.OwnerBy
		if platform == "" {
			platform = vendorNames[item.VendorID]
		}
		if platform == "" {
			platform = "unknown"
		}

		price := publicTransitPrice{}
		if item.QuotaType == 1 {
			if !validPublicTransitRatio(item.ModelPrice) {
				continue
			}
			perRequest := item.ModelPrice
			price.PerRequestUSD = &perRequest
		} else {
			if !validPublicTransitRatio(item.ModelRatio) || !validPublicTransitRatio(item.CompletionRatio) || !validPublicTransitRatio(common.QuotaPerUnit) || common.QuotaPerUnit == 0 {
				continue
			}
			input := item.ModelRatio / common.QuotaPerUnit
			output := input * item.CompletionRatio
			if !validPublicTransitRatio(input) || !validPublicTransitRatio(output) {
				continue
			}
			price.InputUSDPerToken = &input
			price.OutputUSDPerToken = &output
			if item.CacheRatio != nil && validPublicTransitRatio(*item.CacheRatio) {
				cacheRead := input * *item.CacheRatio
				if validPublicTransitRatio(cacheRead) {
					price.CacheReadUSDPerToken = &cacheRead
				}
			}
			if item.CreateCacheRatio != nil && validPublicTransitRatio(*item.CreateCacheRatio) {
				cacheWrite := input * *item.CreateCacheRatio
				if validPublicTransitRatio(cacheWrite) {
					price.CacheWriteUSDPerToken = &cacheWrite
				}
			}
			if item.ImageRatio != nil && validPublicTransitRatio(*item.ImageRatio) {
				image := input * *item.ImageRatio
				if validPublicTransitRatio(image) {
					price.ImageUSDPerToken = &image
				}
			}
		}

		protocols := make([]string, 0, len(item.SupportedEndpointTypes))
		for _, endpointType := range item.SupportedEndpointTypes {
			protocols = append(protocols, string(endpointType))
		}
		catalogModels = append(catalogModels, publicTransitCatalogModel{
			ModelName:              item.ModelName,
			VendorID:               item.VendorID,
			QuotaType:              item.QuotaType,
			ModelRatio:             item.ModelRatio,
			ModelPrice:             item.ModelPrice,
			CompletionRatio:        item.CompletionRatio,
			CacheRatio:             item.CacheRatio,
			CreateCacheRatio:       item.CreateCacheRatio,
			EnableGroups:           slices.Clone(item.EnableGroup),
			SupportedEndpointTypes: slices.Clone(protocols),
			BillingMode:            item.BillingMode,
			BillingExpr:            item.BillingExpr,
			PricingVersion:         item.PricingVersion,
		})
		if item.CacheRatio != nil || item.CreateCacheRatio != nil || strings.Contains(item.BillingExpr, "cr") || strings.Contains(item.BillingExpr, "cc") {
			cacheModels[item.ModelName] = struct{}{}
		}

		transitModel := publicTransitModel{
			StandardModel: item.ModelName,
			RawModel:      item.ModelName,
			Platform:      platform,
			BillingMode:   billingMode,
			PriceSource:   "new_api_pricing",
			CatalogSource: "new_api_abilities",
			Price:         price,
			Source: publicTransitModelSource{
				UpstreamType:    "mixed_or_unknown",
				AccountPoolType: "mixed_or_unknown",
				Disclosure:      "public group-level source classification",
			},
			BillingExpr:        item.BillingExpr,
			PricingVersion:     item.PricingVersion,
			SupportedProtocols: protocols,
		}

		for _, groupName := range targetGroups {
			group, ok := groups[groupName]
			if !ok {
				continue
			}
			if _, exists := seenModels[groupName][item.ModelName]; exists {
				continue
			}
			seenModels[groupName][item.ModelName] = struct{}{}
			group.Models = append(group.Models, transitModel)
			if group.Platform == "unknown" {
				group.Platform = platform
			} else if group.Platform != platform {
				group.Platform = "mixed"
			}
		}
	}

	slices.SortFunc(catalogModels, func(a, b publicTransitCatalogModel) int {
		return strings.Compare(a.ModelName, b.ModelName)
	})
	resultGroups := make([]publicTransitGroup, 0, len(groupNames))
	for _, groupName := range groupNames {
		group := groups[groupName]
		slices.SortFunc(group.Models, func(a, b publicTransitModel) int {
			return strings.Compare(a.StandardModel, b.StandardModel)
		})
		resultGroups = append(resultGroups, *group)
	}

	balancePerCNY, minimumTopUp := publicTransitRechargeInfo()
	homepageURL := strings.TrimRight(system_setting.ServerAddress, "/")
	if homepageURL == "" {
		homepageURL = baseURL
	}
	cacheModelNames := make([]string, 0, len(cacheModels))
	for modelName := range cacheModels {
		cacheModelNames = append(cacheModelNames, modelName)
	}
	slices.Sort(cacheModelNames)
	currency := operation_setting.GetQuotaDisplayType()
	if currency == operation_setting.QuotaDisplayTypeTokens {
		currency = "credits"
	}
	rechargeRatio := ""
	rechargeUnit := ""
	if balancePerCNY != nil {
		rechargeRatio = fmt.Sprintf("1:%g", *balancePerCNY)
		rechargeUnit = "USD balance per 1 CNY"
	}

	return publicTransitSnapshot{
		SchemaVersion:   publicTransitSchemaVersion,
		System:          "new_api",
		GeneratedAt:     now.UTC().Format(time.RFC3339),
		CacheTTLSeconds: publicTransitCacheSeconds,
		Site: publicTransitSite{
			Name:       common.SystemName,
			WebsiteURL: homepageURL,
			APIBase:    baseURL + "/v1",
			SystemType: "new_api",
		},
		Billing: publicTransitBilling{
			Currency:                 currency,
			CreditCurrency:           "USD",
			RechargeRatio:            rechargeRatio,
			RechargeMultiplier:       balancePerCNY,
			RechargeMultiplierUnit:   rechargeUnit,
			BalancePerCNY:            balancePerCNY,
			MinimumTopUp:             minimumTopUp,
			ModelBasisPrice:          "USD per token/request/second normalized from New API pricing",
			ModelPriceUnit:           "USD",
			StandardizedPriceVersion: publicTransitSchemaVersion,
			CurrencySymbol:           operation_setting.GetCurrencySymbol(),
			QuotaPerUnit:             common.QuotaPerUnit,
			MinTopUp:                 minimumTopUp,
			TopUpURL:                 common.TopUpLink,
			BalanceValidity:          "not_configured",
			RefundPolicy:             &publicTransitRefundPolicy{Status: "pending_confirmation"},
		},
		Groups:     resultGroups,
		Monitoring: make([]publicTransitMonitoring, 0),
		Cache: publicTransitCache{
			Supported: len(cacheModelNames) > 0,
			Models:    cacheModelNames,
			WriteUnit: "USD per token",
			ReadUnit:  "USD per token",
		},
		Completeness: publicTransitCompleteness{
			HasRechargeRatio:    balancePerCNY != nil,
			HasGroupMultipliers: len(resultGroups) > 0,
			HasModelPricing:     len(catalogModels) > 0,
			HasMonitoring:       false,
			HasCacheUsage:       cacheUsageAvailable,
			HasSourceDisclosure: true,
		},
		Disclosure: publicTransitDisclosure{
			UpstreamType:    "mixed_or_unknown",
			AccountPoolType: "mixed_or_unknown",
			IsMixed:         true,
			IsReverse:       true,
			Note:            "Public snapshot exposes normalized pricing, group-level source categories, and aggregate cache usage; credentials, user records, upstream URLs, and internal channel IDs are excluded.",
		},
		Endpoints: publicTransitEndpoints{
			DiscoveryURL:  baseURL + "/.well-known/ai-transit.json",
			SnapshotURL:   baseURL + "/api/public/transit/v1/snapshot",
			PublicPageURL: homepageURL + "/pricing",
		},
		Limits: publicTransitLimits{
			ModelRequestRateLimitEnabled: setting.ModelRequestRateLimitEnabled,
			DefaultWindowMinutes:         setting.ModelRequestRateLimitDurationMinutes,
			DefaultRequestCount:          setting.ModelRequestRateLimitSuccessCount,
		},
		Models:            catalogModels,
		PromotionalGroups: make([]publicTransitPromotionalGroup, 0),
		ServiceAvailability: publicTransitServiceAvailability{
			IncludedInServiceScore:  false,
			WindowHours:             168,
			MinSamplesForPercentage: 1,
			IncludedGroups:          make([]string, 0),
			Groups:                  make([]publicTransitAvailabilityGroup, 0),
		},
		ServiceGroups: serviceGroups,
		Station: publicTransitStation{
			Name:        common.SystemName,
			HomepageURL: homepageURL,
			PriceURL:    homepageURL + "/pricing",
			SystemType:  "new_api",
		},
		Testing: publicTransitTesting{
			PublicTestKeyExposed: false,
			ReviewerAccess:       "not_configured",
			UserTrial:            "not_configured",
		},
	}
}

func publicTransitGroupNames(usableGroups map[string]string, groupRatios map[string]float64) []string {
	groupNames := make([]string, 0, len(groupRatios))
	for groupName, ratio := range groupRatios {
		if !validPublicTransitRatio(ratio) {
			continue
		}
		if _, ok := usableGroups[groupName]; ok {
			groupNames = append(groupNames, groupName)
		}
	}
	slices.Sort(groupNames)
	return groupNames
}

func getPublicTransitCacheUsage(groupNames []string, now time.Time) (publicTransitCacheUsageSnapshot, bool) {
	groupKey := strings.Join(groupNames, "\x00")
	publicTransitCacheUsageState.Lock()
	defer publicTransitCacheUsageState.Unlock()
	if publicTransitCacheUsageState.groupKey == groupKey && now.Before(publicTransitCacheUsageState.expiresAt) {
		return publicTransitCacheUsageState.data, publicTransitCacheUsageState.available
	}

	last24Hours, err := model.GetPublicTransitCacheUsage(now.Add(-24*time.Hour).Unix(), groupNames)
	if err != nil {
		common.SysError("failed to aggregate public transit 24h cache usage: " + err.Error())
		storePublicTransitCacheUsage(groupKey, now, publicTransitCacheUsageSnapshot{}, false)
		return publicTransitCacheUsageSnapshot{}, false
	}
	last7Days, err := model.GetPublicTransitCacheUsage(now.Add(-7*24*time.Hour).Unix(), groupNames)
	if err != nil {
		common.SysError("failed to aggregate public transit 7d cache usage: " + err.Error())
		storePublicTransitCacheUsage(groupKey, now, publicTransitCacheUsageSnapshot{}, false)
		return publicTransitCacheUsageSnapshot{}, false
	}
	total, err := model.GetPublicTransitCacheUsage(0, groupNames)
	if err != nil {
		common.SysError("failed to aggregate public transit total cache usage: " + err.Error())
		storePublicTransitCacheUsage(groupKey, now, publicTransitCacheUsageSnapshot{}, false)
		return publicTransitCacheUsageSnapshot{}, false
	}
	data := publicTransitCacheUsageSnapshot{Last24Hours: last24Hours, Last7Days: last7Days, Total: total}
	storePublicTransitCacheUsage(groupKey, now, data, true)
	return data, true
}

func storePublicTransitCacheUsage(groupKey string, now time.Time, data publicTransitCacheUsageSnapshot, available bool) {
	publicTransitCacheUsageState.groupKey = groupKey
	publicTransitCacheUsageState.expiresAt = now.Add(time.Duration(publicTransitCacheSeconds) * time.Second)
	publicTransitCacheUsageState.data = data
	publicTransitCacheUsageState.available = available
}

func buildPublicTransitGroupCacheUsage(groupName string, snapshot publicTransitCacheUsageSnapshot) *publicTransitCacheUsage {
	return &publicTransitCacheUsage{
		Last24Hours: publicTransitCacheUsagePeriodFromModel("last_24h", snapshot.Last24Hours[groupName]),
		Last7Days:   publicTransitCacheUsagePeriodFromModel("last_7d", snapshot.Last7Days[groupName]),
		Total:       publicTransitCacheUsagePeriodFromModel("total", snapshot.Total[groupName]),
	}
}

func publicTransitCacheUsagePeriodFromModel(period string, usage model.PublicTransitCacheUsage) publicTransitCacheUsagePeriod {
	// input_tokens preserves the historical prompt_tokens aggregate. The explicit
	// total includes caches exactly once across upstream usage semantics.
	var totalInput *int64
	var hitRate *float64
	if usage.IncompleteRequests == 0 {
		totalInput = &usage.TotalInputTokens
		rate := 0.0
		if usage.TotalInputTokens > 0 {
			rate = float64(usage.CacheReadTokens) / float64(usage.TotalInputTokens) * 100
		}
		hitRate = &rate
	}
	return publicTransitCacheUsagePeriod{
		Period:              period,
		InputTokens:         usage.InputTokens,
		CacheCreationTokens: usage.CacheCreationTokens,
		CacheReadTokens:     usage.CacheReadTokens,
		CacheHitRate:        hitRate,
		TotalInputTokens:    totalInput,
		UsageComplete:       usage.IncompleteRequests == 0,
	}
}

func publicTransitRechargeInfo() (*float64, *float64) {
	if operation_setting.Price <= 0 || math.IsNaN(operation_setting.Price) || math.IsInf(operation_setting.Price, 0) {
		return nil, nil
	}
	balance := 1 / operation_setting.Price
	minimum := float64(operation_setting.MinTopUp) * operation_setting.Price
	if !validPublicTransitRatio(minimum) {
		return &balance, nil
	}
	return &balance, &minimum
}

func publicTransitBaseURL(c *gin.Context) string {
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	if forwarded := c.GetHeader("X-Forwarded-Proto"); forwarded != "" {
		if first, _, ok := strings.Cut(forwarded, ","); ok {
			forwarded = first
		}
		forwarded = strings.TrimSpace(forwarded)
		if forwarded == "http" || forwarded == "https" {
			scheme = forwarded
		}
	}
	if c.Request.Host != "" {
		return scheme + "://" + c.Request.Host
	}
	return strings.TrimRight(system_setting.ServerAddress, "/")
}

func validPublicTransitRatio(value float64) bool {
	return value >= 0 && !math.IsNaN(value) && !math.IsInf(value, 0)
}
