package model

import (
	"context"
	"errors"
	"slices"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	publicTransitUsageBatchSize     = 500
	publicTransitUsageRollupVersion = 2
)

var (
	ErrPublicTransitCacheUsageBusy    = errors.New("database has no spare capacity for public statistics")
	ErrPublicTransitCacheUsagePending = errors.New("public statistics backfill is in progress")
)

type PublicTransitCacheUsage struct {
	Group               string
	InputTokens         int64
	CacheCreationTokens int64
	CacheReadTokens     int64
	TotalInputTokens    int64
	IncompleteRequests  int64
	KnownRequests       int64
}

// Windows are [AsOf-duration, AsOf). Total retains its public name, but is 30 days.
// AsOf is a completed hour, with a five-minute grace period for log writes.
type PublicTransitCacheUsageSnapshot struct {
	Last24Hours map[string]PublicTransitCacheUsage
	Last7Days   map[string]PublicTransitCacheUsage
	Total       map[string]PublicTransitCacheUsage
	AsOf        time.Time
	// Version of the durable rollups, including an in-progress rebuild. An old
	// published snapshot may still be served until that rebuild is complete.
	RollupVersion int
}

// Both tables live in the primary database, even when logs use ClickHouse.
// Published remains intact while hourly rows are being backfilled/rebuilt.
type PublicTransitUsageState struct {
	ID              int    `gorm:"primaryKey;autoIncrement:false"`
	Lease           string `gorm:"type:varchar(64)"`
	LeaseUntil      int64
	NextRun         int64
	Target          int64
	CursorTime      int64
	CursorID        int64
	CursorRequestID string `gorm:"type:varchar(64)"`
	Complete        bool
	Published       LongText
}

type PublicTransitUsageHour struct {
	Hour  int64 `gorm:"primaryKey;autoIncrement:false"`
	Usage LongText
}

// GetPublicTransitCacheUsage advances at most one bounded batch. Callers must
// retry Pending outside the HTTP path; a nonzero AsOf is always a fully published
// snapshot and may be served even while more recent statistics are pending.
func GetPublicTransitCacheUsage(ctx context.Context, now time.Time, groups []string) (result PublicTransitCacheUsageSnapshot, err error) {
	if err = ctx.Err(); err != nil {
		return
	}
	if len(groups) == 0 {
		return result, nil
	}
	if DB == nil || LOG_DB == nil {
		return result, errors.New("statistics databases are not initialized")
	}
	for _, db := range []*gorm.DB{DB, LOG_DB} {
		poolDB, poolErr := db.DB()
		if poolErr != nil {
			return result, poolErr
		}
		pool := poolDB.Stats()
		// Admission control leaves at least 20% of connections for business.
		// It cannot isolate disk/CPU; each log read is also bounded and timed out.
		if pool.MaxOpenConnections > 0 && pool.InUse+1 > pool.MaxOpenConnections-max(1, pool.MaxOpenConnections/5) || pool.InUse > 0 && pool.Idle == 0 {
			return result, ErrPublicTransitCacheUsageBusy
		}
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	db := DB.WithContext(ctx)
	state := PublicTransitUsageState{ID: 1}
	if err = db.Clauses(clause.OnConflict{DoNothing: true}).Create(&state).Error; err != nil {
		return
	}
	if err = db.First(&state, 1).Error; err != nil {
		return
	}
	if state.Published != "" {
		if err = common.UnmarshalJsonStr(string(state.Published), &result); err != nil {
			return
		}
		for _, period := range []map[string]PublicTransitCacheUsage{result.Last24Hours, result.Last7Days, result.Total} {
			for group := range period {
				if !slices.Contains(groups, group) {
					delete(period, group)
				}
			}
		}
	}
	target := now.Add(-5 * time.Minute).Truncate(time.Hour).Unix()
	rebuild := result.RollupVersion != publicTransitUsageRollupVersion
	if !rebuild && state.Complete && state.Target >= target {
		return
	}
	lease := common.NewRequestId()
	wallNow := time.Now()
	claim := db.Model(&PublicTransitUsageState{}).Where("id = ? AND lease_until <= ? AND next_run <= ?", 1, wallNow.UnixNano(), wallNow.UnixNano()).
		Updates(map[string]any{"lease": lease, "lease_until": wallNow.Add(30 * time.Second).UnixNano()})
	if claim.Error != nil {
		return result, claim.Error
	}
	if claim.RowsAffected != 1 {
		return result, ErrPublicTransitCacheUsageBusy
	}
	// A failed/expired batch never commits its cursor. Backoff is shared across
	// instances, so public traffic cannot turn a failing query into a retry storm.
	defer func() {
		delay := time.Second
		if err != nil && !errors.Is(err, ErrPublicTransitCacheUsagePending) {
			delay = 15 * time.Minute
		}
		releaseCtx, releaseCancel := context.WithTimeout(context.Background(), time.Second)
		defer releaseCancel()
		DB.WithContext(releaseCtx).Model(&PublicTransitUsageState{}).Where("id = ? AND lease = ?", 1, lease).
			Updates(map[string]any{"lease_until": int64(0), "next_run": time.Now().Add(delay).UnixNano()})
	}()
	if err = db.First(&state, 1).Error; err != nil {
		return
	}
	// Re-read the version after claiming the lease: another instance may have
	// started or completed the rebuild after our initial publication read.
	var publication PublicTransitCacheUsageSnapshot
	if state.Published != "" {
		if err = common.UnmarshalJsonStr(string(state.Published), &publication); err != nil {
			return
		}
	}
	rebuild = publication.RollupVersion != publicTransitUsageRollupVersion
	if !rebuild && state.Complete && state.Target >= target {
		return result, ErrPublicTransitCacheUsagePending
	}
	reset := rebuild || state.Target == 0 || state.Complete
	start := target - int64(30*24*time.Hour/time.Second)
	if reset {
		if !rebuild && state.Target != 0 {
			start = max(start, state.Target-2*3600)
		}
		state.Target = target
		state.CursorTime, state.CursorID, state.CursorRequestID = start-1, 0, ""
		state.Complete = false
		publication.RollupVersion = publicTransitUsageRollupVersion
		var encoded []byte
		encoded, err = common.Marshal(publication)
		if err != nil {
			return
		}
		state.Published = LongText(encoded)
	} else {
		start = state.Target - int64(30*24*time.Hour/time.Second)
	}
	var logs []Log
	query := LOG_DB.WithContext(ctx).Model(&Log{}).
		Select("id, created_at, type, "+logGroupCol+", prompt_tokens, request_id, other").
		Where("created_at >= ? AND created_at < ?", start, state.Target)
	if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		// WITH TIES keeps duplicate request IDs together (including historical
		// empty IDs). Oversized ties fail instead of silently skipping records.
		query = query.Where("(created_at, request_id) > (?, ?)", state.CursorTime, state.CursorRequestID).
			Order("created_at, request_id")
		stmt := query.Session(&gorm.Session{DryRun: true}).Find(&logs).Statement
		err = LOG_DB.WithContext(ctx).Raw(stmt.SQL.String()+" LIMIT 500 WITH TIES SETTINGS max_threads=1, max_execution_time=2, max_result_rows=1000, result_overflow_mode='throw'", stmt.Vars...).Scan(&logs).Error
	} else {
		// Separate the cursor's timestamp from later timestamps so all supported
		// engines can seek both parts of idx_created_at_id. A broad OR predicate
		// can repeatedly scan the already processed prefix on large log tables.
		if state.CursorTime >= start {
			err = query.Session(&gorm.Session{}).Where("created_at = ? AND id > ?", state.CursorTime, state.CursorID).
				Order("id").Limit(publicTransitUsageBatchSize).Find(&logs).Error
		}
		if err == nil && len(logs) < publicTransitUsageBatchSize {
			var later []Log
			err = query.Session(&gorm.Session{}).Where("created_at > ?", state.CursorTime).
				Order("created_at, id").Limit(publicTransitUsageBatchSize - len(logs)).Find(&later).Error
			logs = append(logs, later...)
		}
	}
	if err != nil {
		return
	}
	hours := make(map[int64][]Log)
	for _, log := range logs {
		if log.Type == LogTypeConsume {
			hour := log.CreatedAt / 3600 * 3600
			hours[hour] = append(hours[hour], log)
		}
	}
	if len(logs) > 0 {
		last := logs[len(logs)-1]
		state.CursorTime, state.CursorID, state.CursorRequestID = last.CreatedAt, int64(last.Id), last.RequestId
	}
	state.Complete = len(logs) < publicTransitUsageBatchSize
	err = db.Transaction(func(tx *gorm.DB) error {
		// Fence the entire transaction before touching rollups. A worker whose
		// lease expired cannot commit after another instance takes over.
		fence := tx.Model(&PublicTransitUsageState{}).Where("id = ? AND lease = ? AND lease_until > ?", 1, lease, time.Now().UnixNano()).Update("lease_until", time.Now().Add(30*time.Second).UnixNano())
		if fence.Error != nil {
			return fence.Error
		}
		if fence.RowsAffected != 1 {
			return ErrPublicTransitCacheUsageBusy
		}
		if reset {
			if e := tx.Where("hour >= ? OR hour < ?", start, state.Target-30*24*3600).Delete(&PublicTransitUsageHour{}).Error; e != nil {
				return e
			}
		}
		for hour, entries := range hours {
			row := PublicTransitUsageHour{Hour: hour}
			usage := make(map[string]PublicTransitCacheUsage)
			if e := tx.Where("hour = ?", hour).Find(&row).Error; e != nil {
				return e
			}
			if row.Usage != "" {
				if e := common.UnmarshalJsonStr(string(row.Usage), &usage); e != nil {
					return e
				}
			}
			for _, log := range entries {
				total := usage[log.Group]
				total.add(publicTransitLogUsage(log))
				usage[log.Group] = total
			}
			data, e := common.Marshal(usage)
			if e != nil {
				return e
			}
			row.Usage = LongText(data)
			if e = tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "hour"}}, DoUpdates: clause.AssignmentColumns([]string{"usage"})}).Create(&row).Error; e != nil {
				return e
			}
		}
		if state.Complete {
			var rows []PublicTransitUsageHour
			if e := tx.Where("hour >= ? AND hour < ?", state.Target-30*24*3600, state.Target).Find(&rows).Error; e != nil {
				return e
			}
			snapshot := PublicTransitCacheUsageSnapshot{RollupVersion: publicTransitUsageRollupVersion, AsOf: time.Unix(state.Target, 0).UTC(), Last24Hours: map[string]PublicTransitCacheUsage{}, Last7Days: map[string]PublicTransitCacheUsage{}, Total: map[string]PublicTransitCacheUsage{}}
			for _, row := range rows {
				var usage map[string]PublicTransitCacheUsage
				if e := common.UnmarshalJsonStr(string(row.Usage), &usage); e != nil {
					return e
				}
				periods := []map[string]PublicTransitCacheUsage{snapshot.Total}
				if row.Hour >= state.Target-7*24*3600 {
					periods = append(periods, snapshot.Last7Days)
				}
				if row.Hour >= state.Target-24*3600 {
					periods = append(periods, snapshot.Last24Hours)
				}
				for _, period := range periods {
					for group, value := range usage {
						total := period[group]
						total.add(value)
						period[group] = total
					}
				}
			}
			for _, period := range []map[string]PublicTransitCacheUsage{snapshot.Last24Hours, snapshot.Last7Days, snapshot.Total} {
				for group, usage := range period {
					usage.InputTokens = max(usage.InputTokens, 0)
					usage.CacheReadTokens = max(usage.CacheReadTokens, 0)
					usage.CacheCreationTokens = max(usage.CacheCreationTokens, 0)
					period[group] = usage
				}
			}
			data, e := common.Marshal(snapshot)
			if e != nil {
				return e
			}
			state.Published = LongText(data)
		}
		return tx.Model(&PublicTransitUsageState{}).Where("id = ? AND lease = ?", 1, lease).
			Updates(map[string]any{"target": state.Target, "cursor_time": state.CursorTime, "cursor_id": state.CursorID, "cursor_request_id": state.CursorRequestID, "complete": state.Complete, "published": state.Published}).Error
	})
	if err != nil {
		return
	}
	// Read publication on the next call, including after completing a first fill.
	// This keeps the same public-group filtering for cached and new results.
	return result, ErrPublicTransitCacheUsagePending
}

func (usage *PublicTransitCacheUsage) add(value PublicTransitCacheUsage) {
	usage.Group = value.Group
	usage.InputTokens += value.InputTokens
	usage.CacheCreationTokens += value.CacheCreationTokens
	usage.CacheReadTokens += value.CacheReadTokens
	usage.TotalInputTokens += value.TotalInputTokens
	usage.IncompleteRequests += value.IncompleteRequests
	usage.KnownRequests += value.KnownRequests
}

func publicTransitLogUsage(log Log) PublicTransitCacheUsage {
	var metadata struct {
		Read       int64    `json:"cache_tokens"`
		Write      *int64   `json:"cache_write_tokens"`
		Creation   int64    `json:"cache_creation_tokens"`
		Creation5m int64    `json:"cache_creation_tokens_5m"`
		Creation1h int64    `json:"cache_creation_tokens_1h"`
		Total      *int64   `json:"input_tokens_total"`
		Semantic   string   `json:"usage_semantic"`
		Claude     any      `json:"claude"`
		Conversion []string `json:"request_conversion"`
		Admin      struct {
			Path string `json:"usage_billing_path"`
		} `json:"admin_info"`
	}
	usage := PublicTransitCacheUsage{Group: log.Group, InputTokens: int64(log.PromptTokens)}
	if common.UnmarshalJsonStr(log.Other, &metadata) != nil {
		return PublicTransitCacheUsage{Group: log.Group, IncompleteRequests: 1}
	}
	usage.CacheReadTokens = metadata.Read
	usage.CacheCreationTokens = max(metadata.Creation, metadata.Creation5m+metadata.Creation1h)
	if metadata.Write != nil {
		usage.CacheCreationTokens = *metadata.Write
	}
	semantic := metadata.Semantic
	if semantic == "" {
		switch strings.TrimSuffix(metadata.Admin.Path, "-estimated") {
		case "billing-usage-openai":
			semantic = "openai"
		case "billing-usage-anthropic":
			semantic = "anthropic"
		case "billing-usage-gemini":
			semantic = "gemini"
		default:
			if metadata.Claude == true || metadata.Claude == float64(1) || metadata.Creation5m > 0 || metadata.Creation1h > 0 {
				semantic = "anthropic"
			} else if n := len(metadata.Conversion); n > 0 {
				// Legacy logs did not persist usage_semantic. Use the final
				// upstream protocol, never the client request path or model name.
				// Claude-derived split cache usage above remains exclusive input.
				switch metadata.Conversion[n-1] {
				case "OpenAI Compatible", "OpenAI Responses", "openai_responses_compaction":
					semantic = "openai"
				case "Google Gemini":
					semantic = "gemini"
				case "Claude Messages":
					semantic = "anthropic"
				}
			}
		}
	}
	switch {
	case usage.InputTokens < 0 || usage.CacheReadTokens < 0 || usage.CacheCreationTokens < 0:
		usage.IncompleteRequests = 1
	case metadata.Total != nil && *metadata.Total >= metadata.Read:
		usage.TotalInputTokens = *metadata.Total
	case metadata.Total != nil:
		usage.IncompleteRequests = 1
	case semantic == "anthropic":
		usage.TotalInputTokens = usage.InputTokens + usage.CacheReadTokens + usage.CacheCreationTokens
	case (semantic == "openai" || semantic == "gemini") && usage.InputTokens >= metadata.Read:
		usage.TotalInputTokens = usage.InputTokens
	default:
		usage.IncompleteRequests = 1
	}
	if usage.IncompleteRequests != 0 {
		// Filter the entire record, not just its denominator: all displayed
		// counts and the cache-hit numerator must describe the same cohort.
		return PublicTransitCacheUsage{Group: log.Group, IncompleteRequests: 1}
	}
	usage.KnownRequests = 1
	return usage
}
