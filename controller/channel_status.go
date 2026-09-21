package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

func GetChannelStatus(c *gin.Context) {
	activeGroups := append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto")
	result, err := service.QueryChannelStatus(activeGroups)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func GetAllChannelStatus(c *gin.Context) {
	result, err := service.QueryAllChannelStatus()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func UpdateChannelStatusVisibility(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelId <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	request := struct {
		Visible *bool `json:"visible"`
	}{}
	if err := c.ShouldBindJSON(&request); err != nil || request.Visible == nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if err := service.UpdateChannelStatusVisibility(channelId, *request.Visible); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "channel.update", map[string]any{
		"id":                     channelId,
		"channel_status_visible": *request.Visible,
	})
	common.ApiSuccess(c, gin.H{"visible": *request.Visible})
}

func UpdateChannelActiveTestEnabled(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelId <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	request := struct {
		Enabled *bool `json:"enabled"`
	}{}
	if err := c.ShouldBindJSON(&request); err != nil || request.Enabled == nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if err := service.UpdateChannelActiveTestEnabled(channelId, *request.Enabled); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "channel.update", map[string]any{
		"id":                  channelId,
		"active_test_enabled": *request.Enabled,
	})
	common.ApiSuccess(c, gin.H{"active_test_enabled": *request.Enabled})
}

func UpdateChannelStatusHealthyThreshold(c *gin.Context) {
	request := struct {
		HealthySeconds int `json:"healthy_seconds"`
	}{}
	if err := c.ShouldBindJSON(&request); err != nil || operation_setting.ValidateChannelStatusHealthySeconds(strconv.Itoa(request.HealthySeconds)) != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if err := service.UpdateChannelStatusHealthySeconds(request.HealthySeconds); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "option.update", map[string]any{
		"key": operation_setting.ChannelStatusHealthySecondsOptionKey,
	})
	common.ApiSuccess(c, gin.H{
		"healthy_seconds":     request.HealthySeconds,
		"degraded_latency_ms": operation_setting.GetChannelStatusHealthyLatencyMs(),
	})
}

func ClearChannelStatusTestRecords(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelId <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	deletedCount, err := service.ClearChannelStatusTestRecords(channelId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "channel.test_history_clear", map[string]any{
		"id":    channelId,
		"count": deletedCount,
	})
	common.ApiSuccess(c, gin.H{"deleted_count": deletedCount})
}
