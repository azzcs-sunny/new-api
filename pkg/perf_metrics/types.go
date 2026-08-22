package perfmetrics

import (
	"sync"
	"sync/atomic"
	"time"
)

type Store interface {
	Record(sample Sample)
	Query(params QueryParams) (QueryResult, error)
}

type Sample struct {
	Model        string
	Group        string
	LatencyMs    int64
	TtftMs       int64
	HasTtft      bool
	Success      bool
	OutputTokens int64
	GenerationMs int64
	RecordedAtNs int64
}

type ChannelSample struct {
	ChannelId   int
	ChannelType int
	Sample
}

type QueryParams struct {
	Model string
	Group string
	Hours int
}

type BucketPoint struct {
	Ts           int64   `json:"ts"`
	AvgTtftMs    int64   `json:"avg_ttft_ms"`
	AvgLatencyMs int64   `json:"avg_latency_ms"`
	SuccessRate  float64 `json:"success_rate"`
	AvgTps       float64 `json:"avg_tps"`
}

type GroupResult struct {
	Group        string        `json:"group"`
	AvgTtftMs    int64         `json:"avg_ttft_ms"`
	AvgLatencyMs int64         `json:"avg_latency_ms"`
	SuccessRate  float64       `json:"success_rate"`
	AvgTps       float64       `json:"avg_tps"`
	Series       []BucketPoint `json:"series"`
}

type QueryResult struct {
	ModelName    string        `json:"model_name"`
	SeriesSchema string        `json:"series_schema"`
	Groups       []GroupResult `json:"groups"`
}

type ModelSummary struct {
	ModelName          string    `json:"model_name"`
	AvgLatencyMs       int64     `json:"avg_latency_ms"`
	SuccessRate        float64   `json:"success_rate"`
	AvgTps             float64   `json:"avg_tps"`
	RecentSuccessRates []float64 `json:"recent_success_rates,omitempty"`
	RequestCount       int64     `json:"-"`
}

type SummaryAllResult struct {
	Models []ModelSummary `json:"models"`
}

type ChannelStatusHealth string

const (
	ChannelStatusHealthUnknown  ChannelStatusHealth = "unknown"
	ChannelStatusHealthHealthy  ChannelStatusHealth = "healthy"
	ChannelStatusHealthWarning  ChannelStatusHealth = "warning"
	ChannelStatusHealthCritical ChannelStatusHealth = "critical"
)

type ChannelStatusPoint struct {
	Ts           int64   `json:"ts"`
	RequestCount int64   `json:"request_count"`
	SuccessCount int64   `json:"success_count"`
	AvgTtftMs    int64   `json:"avg_ttft_ms"`
	AvgLatencyMs int64   `json:"avg_latency_ms"`
	SuccessRate  float64 `json:"success_rate"`
	AvgTps       float64 `json:"avg_tps"`
	HasData      bool    `json:"has_data"`
}

type ChannelStatusSummary struct {
	AvgTtftMs       int64               `json:"avg_ttft_ms"`
	AvgLatencyMs    int64               `json:"avg_latency_ms"`
	LatestLatencyMs int64               `json:"latest_latency_ms"`
	SuccessRate     float64             `json:"success_rate"`
	AvgTps          float64             `json:"avg_tps"`
	Health          ChannelStatusHealth `json:"health"`
	HasData         bool                `json:"has_data"`
}

type ChannelStatusRow struct {
	ChannelType int                  `json:"channel_type"`
	Provider    string               `json:"provider"`
	Group       string               `json:"group"`
	ModelName   string               `json:"model_name"`
	PingMs      int                  `json:"ping_ms"`
	Metrics     ChannelStatusSummary `json:"metrics"`
	Series      []ChannelStatusPoint `json:"series"`
}

type ChannelStatusResult struct {
	Hours         int                  `json:"hours"`
	BucketSeconds int64                `json:"bucket_seconds"`
	FromTs        int64                `json:"from_ts"`
	ThroughTs     int64                `json:"through_ts"`
	Truncated     bool                 `json:"truncated"`
	Summary       ChannelStatusSummary `json:"summary"`
	Series        []ChannelStatusPoint `json:"series"`
	Items         []ChannelStatusRow   `json:"items"`
}

type bucketKey struct {
	model    string
	group    string
	bucketTs int64
}

type channelBucketKey struct {
	channelId   int
	channelType int
	model       string
	group       string
	bucketTs    int64
}

type counters struct {
	requestCount    int64
	successCount    int64
	totalLatencyMs  int64
	ttftSumMs       int64
	ttftCount       int64
	outputTokens    int64
	generationMs    int64
	latestLatencyMs int64
	latestLatencyTs int64
}

type atomicBucket struct {
	requestCount    atomic.Int64
	successCount    atomic.Int64
	totalLatencyMs  atomic.Int64
	ttftSumMs       atomic.Int64
	ttftCount       atomic.Int64
	outputTokens    atomic.Int64
	generationMs    atomic.Int64
	latestMu        sync.Mutex
	latestLatencyMs int64
	latestLatencyTs int64
}

func (b *atomicBucket) add(sample Sample) {
	b.requestCount.Add(1)
	if sample.Success {
		b.successCount.Add(1)
	}
	if sample.LatencyMs > 0 {
		b.totalLatencyMs.Add(sample.LatencyMs)
	}
	if sample.HasTtft && sample.TtftMs >= 0 {
		b.ttftSumMs.Add(sample.TtftMs)
		b.ttftCount.Add(1)
	}
	if sample.OutputTokens > 0 && sample.GenerationMs > 0 {
		b.outputTokens.Add(sample.OutputTokens)
		b.generationMs.Add(sample.GenerationMs)
	}
}

func (b *atomicBucket) addLatestLatency(sample Sample) {
	recordedAtNs := sample.RecordedAtNs
	if recordedAtNs <= 0 {
		recordedAtNs = time.Now().UnixNano()
	}
	b.latestMu.Lock()
	if recordedAtNs > b.latestLatencyTs {
		b.latestLatencyMs = sample.LatencyMs
		b.latestLatencyTs = recordedAtNs
	}
	b.latestMu.Unlock()
}

func (b *atomicBucket) snapshot() counters {
	b.latestMu.Lock()
	latestLatencyMs := b.latestLatencyMs
	latestLatencyTs := b.latestLatencyTs
	b.latestMu.Unlock()
	return counters{
		requestCount:    b.requestCount.Load(),
		successCount:    b.successCount.Load(),
		totalLatencyMs:  b.totalLatencyMs.Load(),
		ttftSumMs:       b.ttftSumMs.Load(),
		ttftCount:       b.ttftCount.Load(),
		outputTokens:    b.outputTokens.Load(),
		generationMs:    b.generationMs.Load(),
		latestLatencyMs: latestLatencyMs,
		latestLatencyTs: latestLatencyTs,
	}
}

func (b *atomicBucket) drain() counters {
	b.latestMu.Lock()
	latestLatencyMs := b.latestLatencyMs
	latestLatencyTs := b.latestLatencyTs
	b.latestLatencyMs = 0
	b.latestLatencyTs = 0
	b.latestMu.Unlock()
	return counters{
		requestCount:    b.requestCount.Swap(0),
		successCount:    b.successCount.Swap(0),
		totalLatencyMs:  b.totalLatencyMs.Swap(0),
		ttftSumMs:       b.ttftSumMs.Swap(0),
		ttftCount:       b.ttftCount.Swap(0),
		outputTokens:    b.outputTokens.Swap(0),
		generationMs:    b.generationMs.Swap(0),
		latestLatencyMs: latestLatencyMs,
		latestLatencyTs: latestLatencyTs,
	}
}

func (b *atomicBucket) addCounters(c counters) {
	if c.requestCount != 0 {
		b.requestCount.Add(c.requestCount)
	}
	if c.successCount != 0 {
		b.successCount.Add(c.successCount)
	}
	if c.totalLatencyMs != 0 {
		b.totalLatencyMs.Add(c.totalLatencyMs)
	}
	if c.ttftSumMs != 0 {
		b.ttftSumMs.Add(c.ttftSumMs)
	}
	if c.ttftCount != 0 {
		b.ttftCount.Add(c.ttftCount)
	}
	if c.outputTokens != 0 {
		b.outputTokens.Add(c.outputTokens)
	}
	if c.generationMs != 0 {
		b.generationMs.Add(c.generationMs)
	}
	if c.latestLatencyTs > 0 {
		b.latestMu.Lock()
		if c.latestLatencyTs > b.latestLatencyTs {
			b.latestLatencyMs = c.latestLatencyMs
			b.latestLatencyTs = c.latestLatencyTs
		}
		b.latestMu.Unlock()
	}
}
