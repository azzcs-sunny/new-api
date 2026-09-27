package relay

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	imageTask "github.com/QuantumNous/new-api/relay/channel/task/image"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAsyncImageTaskProtocol(t *testing.T) {
	t.Run("request preserves optional async and seedream fields", func(t *testing.T) {
		var absent kitdto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"seedream-5-pro","prompt":"cat"}`), &absent))
		assert.Nil(t, absent.Async)

		for _, testCase := range []struct {
			name            string
			value           bool
			wantAsyncFields bool
		}{
			{name: "false keeps legacy sync payload", value: false},
			{name: "true enables task fields", value: true, wantAsyncFields: true},
		} {
			t.Run(testCase.name, func(t *testing.T) {
				raw := `{"model":"seedream-5-pro","prompt":"cat","async":` + map[bool]string{true: "true", false: "false"}[testCase.value] + `,"aspect_ratio":"1:1","quality":"high","seed":0,"detail_level":"high"}`
				var request kitdto.ImageRequest
				require.NoError(t, common.Unmarshal([]byte(raw), &request))
				require.NotNil(t, request.Async)
				assert.Equal(t, testCase.value, *request.Async)
				assert.Equal(t, "1:1", request.AspectRatio)
				require.NotNil(t, request.Seed)
				assert.Zero(t, *request.Seed)
				assert.Contains(t, request.Extra, "aspect_ratio")

				encoded, err := common.Marshal(request)
				require.NoError(t, err)
				if testCase.wantAsyncFields {
					assert.JSONEq(t, raw, string(encoded))
				} else {
					assert.JSONEq(t, `{"model":"seedream-5-pro","prompt":"cat","quality":"high"}`, string(encoded))
				}
			})
		}
	})

	t.Run("status parser exposes image result and failure", func(t *testing.T) {
		_, completed, err := imageTask.ParseTaskResponse([]byte(`{"id":"upstream-1","task_id":"upstream-1","status":"completed","progress":100,"metadata":{"url":"https://cdn.example/image.png"}}`))
		require.NoError(t, err)
		assert.Equal(t, string(model.TaskStatusSuccess), completed.Status)
		assert.Equal(t, "100%", completed.Progress)
		assert.Equal(t, "https://cdn.example/image.png", completed.Url)

		_, failed, err := imageTask.ParseTaskResponse([]byte(`{"task_id":"upstream-2","status":"failed","progress":100,"error":{"code":"generation_failed","message":"blocked"}}`))
		require.NoError(t, err)
		assert.Equal(t, string(model.TaskStatusFailure), failed.Status)
		assert.Equal(t, "blocked", failed.Reason)
	})

	t.Run("poll uses private id and render uses public id", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "/v1/videos/upstream-private", r.URL.Path)
			assert.Equal(t, "Bearer sk-test", r.Header.Get("Authorization"))
			w.Header().Set("Content-Type", "application/json")
			_, err := io.WriteString(w, `{"id":"upstream-private","task_id":"upstream-private","model":"seedream-5-pro","status":"completed","progress":100,"metadata":{"url":"https://cdn.example/image.png"}}`)
			assert.NoError(t, err)
		}))
		defer server.Close()

		adaptor := GetTaskAdaptor(constant.TaskPlatformImageGeneration)
		task := &model.Task{
			TaskID:   "task_public",
			Status:   model.TaskStatusQueued,
			Progress: "0%",
			Properties: model.Properties{
				OriginModelName: "seedream-5-pro",
			},
			PrivateData: model.TaskPrivateData{
				UpstreamTaskID: "upstream-private",
			},
			Data: []byte(`{"id":"upstream-private","task_id":"upstream-private","object":"image.generation.task","model":"seedream-5-pro","status":"queued","progress":0}`),
		}

		response, err := adaptor.FetchTask(server.URL, "sk-test", task, "")
		require.NoError(t, err)
		require.NoError(t, response.Body.Close())

		converter, ok := adaptor.(interface {
			ConvertToOpenAIVideo(*model.Task) ([]byte, error)
		})
		require.True(t, ok)
		body, err := converter.ConvertToOpenAIVideo(task)
		require.NoError(t, err)
		assert.JSONEq(t, `{
			"id":"task_public",
			"task_id":"task_public",
			"object":"image.generation.task",
			"model":"seedream-5-pro",
			"status":"queued",
			"progress":0
		}`, string(body))

		task.Status = model.TaskStatusSuccess
		task.Progress = "100%"
		task.PrivateData.ResultURL = "https://cdn.example/image.png"
		task.Data = []byte(`{"id":"upstream-private","task_id":"upstream-private","status":"completed","progress":100,"metadata":{"url":"https://cdn.example/image.png"}}`)
		body, err = converter.ConvertToOpenAIVideo(task)
		require.NoError(t, err)
		assert.JSONEq(t, `{
			"id":"task_public",
			"task_id":"task_public",
			"object":"image.generation.task",
			"model":"seedream-5-pro",
			"status":"completed",
			"progress":100,
			"metadata":{"url":"https://cdn.example/image.png"}
		}`, string(body))
		assert.NotContains(t, string(body), "upstream-private")
	})
}
