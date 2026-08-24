package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/service"
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
