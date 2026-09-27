package relay

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	imageTask "github.com/QuantumNous/new-api/relay/channel/task/image"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func RelayImageTaskSubmit(c *gin.Context, info *relaycommon.RelayInfo) (*TaskSubmitResult, *dto.TaskError) {
	request, ok := info.Request.(*kitdto.ImageRequest)
	if !ok || info.RelayMode != relayconstant.RelayModeImagesGenerations || request.Async == nil || !*request.Async {
		return nil, service.TaskErrorWrapperLocal(errors.New("async image request is required"), "invalid_request", http.StatusBadRequest)
	}
	if request.Stream != nil && *request.Stream {
		return nil, service.TaskErrorWrapperLocal(errors.New("async and stream cannot both be true"), "invalid_request", http.StatusBadRequest)
	}
	if billingErr := service.PrepareTieredBillingForSelectedGroup(c, info); billingErr != nil {
		return nil, service.TaskErrorFromAPIError(billingErr)
	}

	prepared, apiErr := prepareImageUpstreamRequest(c, info)
	if apiErr != nil {
		return nil, service.TaskErrorFromAPIError(apiErr)
	}
	if prepared.Closer != nil {
		defer prepared.Closer.Close()
	}

	response, err := prepared.Adaptor.DoRequest(c, info, prepared.Body)
	if err != nil {
		return nil, service.TaskErrorWrapper(err, "do_request_failed", http.StatusInternalServerError)
	}
	httpResponse, ok := response.(*http.Response)
	if !ok || httpResponse == nil {
		return nil, service.TaskErrorWrapperLocal(errors.New("upstream returned an empty response"), "fail_to_fetch_task", http.StatusBadGateway)
	}
	defer service.CloseResponseBodyGracefully(httpResponse)
	if httpResponse.StatusCode < http.StatusOK || httpResponse.StatusCode >= http.StatusMultipleChoices {
		apiErr := service.RelayErrorHandler(c.Request.Context(), httpResponse, false)
		service.ResetStatusCode(apiErr, c.GetString("status_code_mapping"))
		return nil, service.TaskErrorFromAPIError(apiErr)
	}

	responseBody, err := io.ReadAll(httpResponse.Body)
	if err != nil {
		return nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	parsed, immediate, err := imageTask.ParseTaskResponse(responseBody)
	if err != nil {
		return nil, service.TaskErrorWrapper(fmt.Errorf("invalid async image response: %w", err), "invalid_response", http.StatusBadGateway)
	}
	upstreamTaskID := strings.TrimSpace(parsed.TaskID)
	if upstreamTaskID == "" {
		upstreamTaskID = strings.TrimSpace(parsed.ID)
	}
	if upstreamTaskID == "" {
		return nil, service.TaskErrorWrapper(errors.New("task_id is empty"), "invalid_response", http.StatusBadGateway)
	}

	info.Action = constant.TaskActionImageGeneration
	finalQuota := info.PriceData.QuotaToPreConsume
	if immediate.Status == model.TaskStatusFailure {
		finalQuota = 0
	}
	info.PriceData.Quota = finalQuota
	return &TaskSubmitResult{
		UpstreamTaskID: upstreamTaskID,
		TaskData:       responseBody,
		Platform:       constant.TaskPlatformImageGeneration,
		Quota:          finalQuota,
		Immediate:      immediate,
	}, nil
}
