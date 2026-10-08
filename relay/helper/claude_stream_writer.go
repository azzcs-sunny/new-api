package helper

import (
	"net/http"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

// ClaudeStreamWriter stops delivery after the first downstream error, while
// allowing protocol handlers to continue collecting upstream billing events.
type ClaudeStreamWriter struct {
	gin.ResponseWriter
	Drain *relaycommon.ClaudeStreamDrain
}

func (w *ClaudeStreamWriter) Write(data []byte) (int, error) {
	if w.Drain.Disconnected() {
		return len(data), nil
	}
	n, err := w.ResponseWriter.Write(data)
	if err != nil || n != len(data) {
		w.Drain.Disconnect()
	}
	return len(data), nil
}

func (w *ClaudeStreamWriter) WriteString(data string) (int, error) {
	return w.Write([]byte(data))
}

func (w *ClaudeStreamWriter) Flush() {
	if !w.Drain.Disconnected() {
		if err := http.NewResponseController(w.ResponseWriter).Flush(); err != nil {
			w.Drain.Disconnect()
		}
	}
}

func (w *ClaudeStreamWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }
