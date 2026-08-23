package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCacheRevalidatesMutableBrandingAssets(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		path         string
		cacheControl string
	}{
		{name: "root", path: "/?source=test", cacheControl: "no-cache"},
		{name: "logo", path: "/logo.png", cacheControl: "no-cache"},
		{name: "favicon", path: "/favicon.ico", cacheControl: "no-cache"},
		{name: "hashed static asset", path: "/static/js/index.abc123.js", cacheControl: "max-age=604800"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			router := gin.New()
			router.Use(Cache())
			router.GET("/*path", func(c *gin.Context) {
				c.Status(http.StatusOK)
			})

			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			require.Equal(t, http.StatusOK, response.Code)
			assert.Equal(t, test.cacheControl, response.Header().Get("Cache-Control"))
			assert.NotEmpty(t, response.Header().Get("Cache-Version"))
		})
	}
}
