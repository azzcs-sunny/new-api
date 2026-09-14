package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveVideoResultURL(t *testing.T) {
	tests := []struct {
		name      string
		baseURL   string
		resultURL string
		want      string
		trusted   bool
	}{
		{
			name:      "xai relative content URL",
			baseURL:   "https://api.example.com",
			resultURL: "/v1/videos/upstream-task/content",
			want:      "https://api.example.com/v1/videos/upstream-task/content",
			trusted:   true,
		},
		{
			name:      "absolute CDN URL",
			baseURL:   "https://api.example.com",
			resultURL: "https://cdn.example.com/video.mp4?token=signed",
			want:      "https://cdn.example.com/video.mp4?token=signed",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, trusted, err := resolveVideoResultURL(test.baseURL, test.resultURL)
			require.NoError(t, err)
			assert.Equal(t, test.want, got)
			assert.Equal(t, test.trusted, trusted)
		})
	}
}

func TestResolveVideoResultURLRejectsInvalidBaseURL(t *testing.T) {
	_, _, err := resolveVideoResultURL("api.example.com", "/v1/videos/task/content")
	require.Error(t, err)
}
