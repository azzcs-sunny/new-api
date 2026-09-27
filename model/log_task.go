package model

import (
	"encoding/json"
	"math"

	"github.com/QuantumNous/new-api/common"
)

// enrichTaskLogs adds read-only task timing and historical billing details.
// Tasks live in the main database, which may differ from the log database.
// Never replace a log's charge with the task's final quota: settlement and
// refund logs represent separate accounting events.
func enrichTaskLogs(logs []*Log) {
	type reference struct {
		log   *Log
		other map[string]json.RawMessage
	}
	references := make(map[string][]reference)
	for _, log := range logs {
		if log == nil || (log.Type != LogTypeConsume && log.Type != LogTypeRefund) {
			continue
		}
		var other map[string]json.RawMessage
		if common.UnmarshalJsonStr(log.Other, &other) != nil {
			continue
		}
		var taskID string
		if common.Unmarshal(other["task_id"], &taskID) != nil || taskID == "" {
			continue
		}
		references[taskID] = append(references[taskID], reference{log, other})
	}
	if len(references) == 0 || DB == nil {
		return
	}
	ids := make([]string, 0, len(references))
	for id := range references {
		ids = append(ids, id)
	}
	var tasks []Task
	if err := DB.Select("task_id", "user_id", "status", "submit_time", "finish_time", "private_data").Where("task_id IN ?", ids).Find(&tasks).Error; err != nil {
		common.SysError("failed to enrich task logs: " + err.Error())
		return
	}
	now := common.GetTimestamp()
	for _, task := range tasks {
		timing := map[string]any{"status": task.Status}
		end := now
		if task.Status == TaskStatusSuccess || task.Status == TaskStatusFailure {
			end = task.FinishTime
		}
		if task.SubmitTime > 0 && end >= task.SubmitTime {
			timing["duration_seconds"] = end - task.SubmitTime
		}
		encodedTiming, err := common.Marshal(timing)
		if err != nil {
			continue
		}
		var encodedBilling []byte
		if billing := taskLogBilling(task.PrivateData.BillingContext); billing != nil {
			encodedBilling, _ = common.Marshal(billing)
		}
		for _, ref := range references[task.TaskID] {
			if ref.log.UserId != task.UserId {
				continue
			}
			ref.other["is_task"] = json.RawMessage("true")
			ref.other["task_timing"] = encodedTiming
			if len(encodedBilling) > 0 {
				ref.other["task_billing"] = encodedBilling
			}
			if encoded, err := common.Marshal(ref.other); err == nil {
				ref.log.Other = string(encoded)
			}
		}
	}
}

// taskLogBilling describes the historical unit price without applying the
// group ratio or altering the quota of any accounting event.
func taskLogBilling(bc *TaskBillingContext) map[string]any {
	if bc == nil || bc.TieredSnapshot != nil {
		return nil
	}
	basePrice := bc.ModelPrice
	if basePrice < 0 {
		basePrice = bc.ModelRatio / 2
	}
	if basePrice < 0 || math.IsNaN(basePrice) || math.IsInf(basePrice, 0) {
		return nil
	}
	if bc.PerCallBilling {
		return map[string]any{
			"billing_unit": "request",
			"base_price":   basePrice,
			"unit_price":   basePrice,
			"quantity":     1,
		}
	}
	durationKey := "seconds"
	if _, ok := bc.OtherRatios[durationKey]; !ok {
		durationKey = "duration"
	}
	quantity := bc.OtherRatios[durationKey]
	if quantity <= 0 || math.IsNaN(quantity) || math.IsInf(quantity, 0) {
		return nil
	}
	unitPrice := basePrice
	multipliers := make(map[string]float64)
	for key, ratio := range bc.OtherRatios {
		if ratio <= 0 || math.IsNaN(ratio) || math.IsInf(ratio, 0) {
			return nil
		}
		if key != durationKey {
			unitPrice *= ratio
			multipliers[key] = ratio
		}
	}
	if math.IsNaN(unitPrice) || math.IsInf(unitPrice, 0) {
		return nil
	}
	return map[string]any{
		"billing_unit": "second",
		"base_price":   basePrice,
		"unit_price":   unitPrice,
		"quantity":     quantity,
		"multipliers":  multipliers,
	}
}
