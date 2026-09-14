package xai

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

const (
	defaultDurationSeconds = 8
	maxDurationSeconds     = 15
)

type imageInput struct {
	URL    string `json:"url,omitempty"`
	FileID string `json:"file_id,omitempty"`
}

type requestPayload struct {
	Model       string      `json:"model"`
	Prompt      string      `json:"prompt,omitempty"`
	Duration    int         `json:"duration,omitempty"`
	AspectRatio string      `json:"aspect_ratio,omitempty"`
	Resolution  string      `json:"resolution,omitempty"`
	Image       *imageInput `json:"image,omitempty"`
}

type submitResponse struct {
	RequestID string `json:"request_id"`
}

type videoResponse struct {
	Status   string `json:"status"`
	Model    string `json:"model"`
	Progress int    `json:"progress"`
	Video    *struct {
		URL      string  `json:"url"`
		Duration float64 `json:"duration"`
	} `json:"video,omitempty"`
	Error *struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.apiKey = info.ApiKey
	a.baseURL = info.ChannelBaseUrl
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	if info.Action == constant.TaskActionRemix {
		return service.TaskErrorWrapperLocal(fmt.Errorf("xAI video remix is not supported"), "unsupported_operation", http.StatusBadRequest)
	}
	req, taskErr := parseTaskRequest(c, info)
	if taskErr != nil {
		return taskErr
	}
	if strings.TrimSpace(req.Prompt) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("prompt is required"), "invalid_request", http.StatusBadRequest)
	}
	c.Set("task_request", req)
	info.Action = constant.TaskActionTextToVideo
	if firstImage(req) != "" || imageFileID(req) != "" {
		info.Action = constant.TaskActionImageToVideo
	}

	request, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapper(err, "get_task_request_failed", http.StatusBadRequest)
	}
	if _, err := resolveDuration(request); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_seconds", http.StatusBadRequest)
	}
	resolution := resolveResolution(request)
	if !isSupportedResolution(info.OriginModelName, resolution) {
		if resolution == "1080p" && info.OriginModelName == "grok-imagine-video" {
			return service.TaskErrorWrapperLocal(fmt.Errorf("resolution 1080p is not supported by model grok-imagine-video; use grok-imagine-video-1.5"), "invalid_resolution", http.StatusBadRequest)
		}
		return service.TaskErrorWrapperLocal(fmt.Errorf("resolution %s is not supported by model %s", resolution, info.OriginModelName), "invalid_resolution", http.StatusBadRequest)
	}
	return nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	duration, err := resolveDuration(req)
	if err != nil {
		return nil
	}
	resolution := resolveResolution(req)
	return map[string]float64{
		"seconds":    float64(duration),
		"resolution": resolutionRatio(resolution),
	}
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/videos/generations", strings.TrimRight(a.baseURL, "/")), nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}
	duration, err := resolveDuration(req)
	if err != nil {
		return nil, err
	}
	payload := requestPayload{
		Model:       info.UpstreamModelName,
		Prompt:      req.Prompt,
		Duration:    duration,
		AspectRatio: resolveAspectRatio(req),
		Resolution:  resolveResolution(req),
	}
	if image := firstImage(req); image != "" {
		payload.Image = &imageInput{URL: image}
	} else if fileID := imageFileID(req); fileID != "" {
		payload.Image = &imageInput{FileID: fileID}
	}
	data, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) ParseResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*channel.TaskSubmitResponse, *taskdto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}

	var response submitResponse
	if err := common.Unmarshal(responseBody, &response); err != nil {
		return nil, service.TaskErrorWrapper(err, "unmarshal_response_failed", http.StatusInternalServerError)
	}
	if strings.TrimSpace(response.RequestID) == "" {
		return nil, service.TaskErrorWrapper(fmt.Errorf("request_id is empty"), "invalid_response", http.StatusInternalServerError)
	}

	video := dto.NewOpenAIVideo()
	video.ID = info.PublicTaskID
	video.TaskID = info.PublicTaskID
	video.Model = info.OriginModelName
	video.CreatedAt = time.Now().Unix()
	return &channel.TaskSubmitResponse{
		UpstreamTaskID: response.RequestID,
		TaskData:       responseBody,
		ClientResponse: video,
	}, nil
}

func (a *TaskAdaptor) FetchTask(baseURL, key string, task *model.Task, proxy string) (*http.Response, error) {
	taskID := ""
	if task != nil {
		taskID = task.GetUpstreamTaskID()
	}
	if strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	url := fmt.Sprintf("%s/v1/videos/%s", strings.TrimRight(baseURL, "/"), taskID)
	req, err := http.NewRequest(http.MethodGet, url, nil)
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

func (a *TaskAdaptor) ParseTaskResult(_ *model.Task, _ *http.Response, respBody []byte) (*relaycommon.TaskInfo, error) {
	var response videoResponse
	if err := common.Unmarshal(respBody, &response); err != nil {
		return nil, err
	}

	result := &relaycommon.TaskInfo{}
	result.Progress = strconv.Itoa(response.Progress) + "%"
	switch strings.ToLower(response.Status) {
	case "pending", "queued", "processing", "in_progress", "running":
		result.Status = model.TaskStatusInProgress
	case "done", "completed", "success":
		result.Status = model.TaskStatusSuccess
		if response.Video != nil {
			result.Url = response.Video.URL
		}
	case "failed", "cancelled", "canceled", "error":
		result.Status = model.TaskStatusFailure
		if response.Error != nil {
			result.Reason = response.Error.Message
		}
		if result.Reason == "" {
			result.Reason = "video generation failed"
		}
	default:
		return nil, fmt.Errorf("unknown xai video status %q", response.Status)
	}
	if result.Progress == "0%" {
		result.Progress = ""
	}
	return result, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return []string{"grok-imagine-video", "grok-imagine-video-1.5"}
}

func (a *TaskAdaptor) GetChannelName() string {
	return "xai-video"
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	return common.Marshal(task.ToOpenAIVideo())
}

func resolveDuration(req relaycommon.TaskSubmitReq) (int, error) {
	seconds := req.Duration
	if req.Seconds != "" {
		parsed, err := strconv.Atoi(req.Seconds)
		if err != nil {
			return 0, fmt.Errorf("seconds must be an integer")
		}
		seconds = parsed
	}
	if seconds == 0 {
		seconds = defaultDurationSeconds
	}
	if seconds < 1 || seconds > maxDurationSeconds {
		return 0, fmt.Errorf("seconds must be between 1 and %d", maxDurationSeconds)
	}
	return seconds, nil
}

func resolveResolution(req relaycommon.TaskSubmitReq) string {
	for _, key := range []string{"resolution", "video_resolution", "resolution_name"} {
		if value, ok := metadataValue(req, key).(string); ok && strings.TrimSpace(value) != "" {
			return normalizeResolution(value)
		}
	}
	if req.Size != "" {
		if resolution := resolutionFromSize(req.Size); resolution != "" {
			return resolution
		}
		return normalizeResolution(req.Size)
	}
	return "480p"
}

func resolveAspectRatio(req relaycommon.TaskSubmitReq) string {
	for _, key := range []string{"aspect_ratio", "aspectRatio", "ratio"} {
		if value, ok := metadataValue(req, key).(string); ok && strings.TrimSpace(value) != "" {
			return value
		}
	}
	return aspectRatioFromSize(req.Size)
}

func metadataValue(req relaycommon.TaskSubmitReq, key string) any {
	if req.Metadata == nil {
		return nil
	}
	if value, ok := req.Metadata[key]; ok {
		return value
	}
	if nested, ok := req.Metadata["metadata"].(map[string]any); ok {
		return nested[key]
	}
	return nil
}

func firstImage(req relaycommon.TaskSubmitReq) string {
	if strings.TrimSpace(req.Image) != "" {
		return strings.TrimSpace(req.Image)
	}
	if len(req.Images) > 0 {
		return strings.TrimSpace(req.Images[0])
	}
	if strings.TrimSpace(req.InputReference) != "" {
		return strings.TrimSpace(req.InputReference)
	}
	return ""
}

func imageFileID(req relaycommon.TaskSubmitReq) string {
	fileID, _ := metadataValue(req, "image_file_id").(string)
	return strings.TrimSpace(fileID)
}

func parseTaskRequest(c *gin.Context, info *relaycommon.RelayInfo) (relaycommon.TaskSubmitReq, *taskdto.TaskError) {
	if strings.HasPrefix(c.GetHeader("Content-Type"), "multipart/form-data") {
		if taskErr := relaycommon.ValidateMultipartDirect(c, info); taskErr != nil {
			return relaycommon.TaskSubmitReq{}, taskErr
		}
		req, err := relaycommon.GetTaskRequest(c)
		if err != nil {
			return relaycommon.TaskSubmitReq{}, service.TaskErrorWrapper(err, "get_task_request_failed", http.StatusBadRequest)
		}
		form, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return relaycommon.TaskSubmitReq{}, service.TaskErrorWrapper(err, "invalid_multipart_form", http.StatusBadRequest)
		}
		defer form.RemoveAll()
		if req.Metadata == nil {
			req.Metadata = make(map[string]any)
		}
		for _, key := range []string{"resolution", "video_resolution", "resolution_name", "aspect_ratio", "aspectRatio", "ratio", "image_file_id"} {
			if values := form.Value[key]; len(values) > 0 && strings.TrimSpace(values[0]) != "" {
				req.Metadata[key] = strings.TrimSpace(values[0])
			}
		}
		return req, nil
	}

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return relaycommon.TaskSubmitReq{}, service.TaskErrorWrapper(err, "invalid_request", http.StatusBadRequest)
	}
	body, err := storage.Bytes()
	if err != nil {
		return relaycommon.TaskSubmitReq{}, service.TaskErrorWrapper(err, "invalid_request", http.StatusBadRequest)
	}
	var raw map[string]any
	if err := common.Unmarshal(body, &raw); err != nil {
		return relaycommon.TaskSubmitReq{}, service.TaskErrorWrapper(err, "invalid_json", http.StatusBadRequest)
	}

	req := relaycommon.TaskSubmitReq{
		Prompt:   stringValue(raw["prompt"]),
		Model:    stringValue(raw["model"]),
		Size:     stringValue(raw["size"]),
		Metadata: raw,
	}
	if value, ok := raw["seconds"]; ok {
		req.Seconds = fmt.Sprintf("%v", value)
	}
	if value, ok := raw["duration"]; ok {
		req.Duration, err = integerValue(value)
		if err != nil {
			return relaycommon.TaskSubmitReq{}, service.TaskErrorWrapperLocal(err, "invalid_seconds", http.StatusBadRequest)
		}
	}
	if image, ok := raw["image"].(map[string]any); ok {
		if url := stringValue(image["url"]); url != "" {
			req.Image = url
		} else if fileID := stringValue(image["file_id"]); fileID != "" {
			req.Metadata["image_file_id"] = fileID
		}
	} else if image := stringValue(raw["image"]); image != "" {
		req.Image = image
	}
	if images, ok := raw["images"].([]any); ok {
		for _, image := range images {
			if imageString := stringValue(image); imageString != "" {
				req.Images = append(req.Images, imageString)
			}
		}
	}
	return req, nil
}

func stringValue(value any) string {
	valueString, _ := value.(string)
	return strings.TrimSpace(valueString)
}

func integerValue(value any) (int, error) {
	switch v := value.(type) {
	case float64:
		if v != float64(int(v)) {
			return 0, fmt.Errorf("duration must be an integer")
		}
		return int(v), nil
	case int:
		return v, nil
	case string:
		return strconv.Atoi(strings.TrimSpace(v))
	default:
		return 0, fmt.Errorf("duration must be an integer")
	}
}

func normalizeResolution(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "480" || value == "480p" {
		return "480p"
	}
	if value == "720" || value == "720p" {
		return "720p"
	}
	if value == "1080" || value == "1080p" {
		return "1080p"
	}
	return value
}

func resolutionFromSize(value string) string {
	width, height, ok := parseDimensions(value)
	if !ok {
		return ""
	}
	shorterEdge := min(width, height)
	switch shorterEdge {
	case 480, 720, 1080:
		return strconv.Itoa(shorterEdge) + "p"
	default:
		return ""
	}
}

func aspectRatioFromSize(value string) string {
	width, height, ok := parseDimensions(value)
	if !ok {
		return ""
	}
	divisor := greatestCommonDivisor(width, height)
	return fmt.Sprintf("%d:%d", width/divisor, height/divisor)
}

func parseDimensions(value string) (int, int, bool) {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(value)), "x")
	if len(parts) != 2 {
		return 0, 0, false
	}
	width, widthErr := strconv.Atoi(strings.TrimSpace(parts[0]))
	height, heightErr := strconv.Atoi(strings.TrimSpace(parts[1]))
	if widthErr != nil || heightErr != nil || width <= 0 || height <= 0 {
		return 0, 0, false
	}
	return width, height, true
}

func greatestCommonDivisor(a, b int) int {
	for b != 0 {
		a, b = b, a%b
	}
	return a
}

func isSupportedResolution(modelName, resolution string) bool {
	if resolution == "480p" || resolution == "720p" {
		return true
	}
	return resolution == "1080p" && modelName == "grok-imagine-video-1.5"
}

func resolutionRatio(resolution string) float64 {
	switch resolution {
	case "720p":
		return 1.5
	case "1080p":
		return 2
	}
	return 1
}
