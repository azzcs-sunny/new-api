package image

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type TaskAdaptor struct {
	taskcommon.BaseBilling
}

func (a *TaskAdaptor) Init(_ *relaycommon.RelayInfo) {}

func (a *TaskAdaptor) ValidateRequestAndSetAction(_ *gin.Context, _ *relaycommon.RelayInfo) *dto.TaskError {
	return service.TaskErrorWrapperLocal(errors.New("image task submission uses /v1/images/generations"), "unsupported_operation", http.StatusBadRequest)
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return "", errors.New("image task submission uses /v1/images/generations")
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, _ *http.Request, _ *relaycommon.RelayInfo) error {
	return errors.New("image task submission uses /v1/images/generations")
}

func (a *TaskAdaptor) BuildRequestBody(_ *gin.Context, _ *relaycommon.RelayInfo) (io.Reader, error) {
	return nil, errors.New("image task submission uses /v1/images/generations")
}

func (a *TaskAdaptor) DoRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ io.Reader) (*http.Response, error) {
	return nil, errors.New("image task submission uses /v1/images/generations")
}

func (a *TaskAdaptor) ParseResponse(_ *gin.Context, _ *http.Response, _ *relaycommon.RelayInfo) (*channel.TaskSubmitResponse, *dto.TaskError) {
	return nil, service.TaskErrorWrapperLocal(errors.New("image task submission uses /v1/images/generations"), "unsupported_operation", http.StatusBadRequest)
}

func (a *TaskAdaptor) GetModelList() []string { return nil }

func (a *TaskAdaptor) GetChannelName() string { return "image-generation" }

func (a *TaskAdaptor) FetchTask(baseURL, key string, task *model.Task, proxy string) (*http.Response, error) {
	if task == nil || strings.TrimSpace(task.GetUpstreamTaskID()) == "" {
		return nil, errors.New("invalid task_id")
	}
	taskURL := fmt.Sprintf("%s/v1/videos/%s", strings.TrimRight(baseURL, "/"), url.PathEscape(task.GetUpstreamTaskID()))
	req, err := http.NewRequest(http.MethodGet, taskURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func ParseTaskResponse(body []byte) (*kitdto.ImageTaskResponse, *relaycommon.TaskInfo, error) {
	var response kitdto.ImageTaskResponse
	if err := common.Unmarshal(body, &response); err != nil {
		return nil, nil, err
	}

	result := &relaycommon.TaskInfo{Progress: strconv.Itoa(response.Progress) + "%"}
	switch strings.ToLower(strings.TrimSpace(response.Status)) {
	case "pending", "queued":
		result.Status = model.TaskStatusQueued
	case "processing", "in_progress", "running":
		result.Status = model.TaskStatusInProgress
	case "completed", "success", "done":
		result.Status = model.TaskStatusSuccess
		result.Progress = taskcommon.ProgressComplete
		if response.Metadata != nil {
			result.Url = response.Metadata.URL
		}
	case "failed", "cancelled", "canceled", "error":
		result.Status = model.TaskStatusFailure
		result.Progress = taskcommon.ProgressComplete
		if response.Error != nil {
			result.Reason = response.Error.Message
		}
		if result.Reason == "" {
			result.Reason = "image generation failed"
		}
	default:
		return nil, nil, fmt.Errorf("unknown image task status %q", response.Status)
	}
	return &response, result, nil
}

func (a *TaskAdaptor) ParseTaskResult(_ *model.Task, _ *http.Response, body []byte) (*relaycommon.TaskInfo, error) {
	_, result, err := ParseTaskResponse(body)
	return result, err
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	if task == nil {
		return nil, errors.New("task is required")
	}
	payload := make(map[string]any)
	if len(task.Data) > 0 {
		if err := common.Unmarshal(task.Data, &payload); err != nil {
			return nil, err
		}
	}

	status := task.Status.ToVideoStatus()
	payload["id"] = task.TaskID
	payload["task_id"] = task.TaskID
	payload["object"] = "image.generation.task"
	payload["model"] = task.Properties.OriginModelName
	payload["status"] = status
	payload["progress"] = imageTaskProgress(task.Progress, status)

	if task.Status == model.TaskStatusSuccess {
		metadata, _ := payload["metadata"].(map[string]any)
		if metadata == nil {
			metadata = make(map[string]any)
		}
		if resultURL := task.GetResultURL(); resultURL != "" {
			metadata["url"] = resultURL
		}
		payload["metadata"] = metadata
		delete(payload, "error")
	} else if task.Status == model.TaskStatusFailure {
		code := "generation_failed"
		if upstreamError, ok := payload["error"].(map[string]any); ok {
			if upstreamCode, ok := upstreamError["code"].(string); ok && upstreamCode != "" {
				code = upstreamCode
			}
		}
		message := task.FailReason
		if message == "" {
			message = "image generation failed"
		}
		payload["error"] = map[string]any{"code": code, "message": message}
	}

	return common.Marshal(payload)
}

func imageTaskProgress(progress, status string) int {
	value, err := strconv.Atoi(strings.TrimSuffix(strings.TrimSpace(progress), "%"))
	if err == nil && value >= 0 && value <= 100 {
		return value
	}
	if status == kitdto.VideoStatusCompleted || status == kitdto.VideoStatusFailed {
		return 100
	}
	return 0
}
