package xai

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMergeXAIStreamUsagePreservesCachedTokens(t *testing.T) {
	usage := &dto.Usage{}
	upstreamUsage := &dto.Usage{
		PromptTokens:         100,
		TotalTokens:          120,
		PromptCacheHitTokens: 80,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 80,
		},
	}

	mergeXAIStreamUsage(usage, upstreamUsage)

	require.NotNil(t, usage)
	assert.Equal(t, 100, usage.PromptTokens)
	assert.Equal(t, 20, usage.CompletionTokens)
	assert.Equal(t, 120, usage.TotalTokens)
	assert.Equal(t, 80, usage.PromptTokensDetails.CachedTokens)
	assert.Equal(t, 80, usage.PromptCacheHitTokens)
}
