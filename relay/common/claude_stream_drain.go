package common

import (
	"context"
	"sync"
	"time"
)

// ClaudeStreamDrain keeps upstream collection alive after downstream delivery
// stops. Its deadline starts at disconnect, including while waiting for headers.
type ClaudeStreamDrain struct {
	mu             sync.Mutex
	client         context.Context
	cancel         context.CancelFunc
	stopWatching   func() bool
	timer          *time.Timer
	limit          time.Duration
	disconnectedAt time.Time
	finishedAt     time.Time
	timedOut       bool
}

func NewClaudeStreamDrain(client context.Context, limit time.Duration) (context.Context, *ClaudeStreamDrain) {
	ctx, cancel := context.WithCancel(context.WithoutCancel(client))
	s := &ClaudeStreamDrain{client: client, cancel: cancel, limit: limit}
	s.stopWatching = context.AfterFunc(client, s.Disconnect)
	return ctx, s
}

func (s *ClaudeStreamDrain) Disconnect() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.disconnectedAt.IsZero() {
		return
	}
	s.disconnectedAt = time.Now()
	if !s.finishedAt.IsZero() {
		return
	}
	s.timer = time.AfterFunc(s.limit, func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		if s.finishedAt.IsZero() {
			s.timedOut = true
			s.cancel()
		}
	})
}

func (s *ClaudeStreamDrain) Disconnected() bool {
	if s == nil {
		return false
	}
	if s.client.Err() != nil {
		s.Disconnect()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return !s.disconnectedAt.IsZero()
}

func (s *ClaudeStreamDrain) Finish() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.finishedAt.IsZero() {
		return
	}
	s.finishedAt = time.Now()
	s.stopWatching()
	if s.timer != nil {
		s.timer.Stop()
	}
	s.cancel()
}

func (s *ClaudeStreamDrain) Snapshot() (disconnectedAt time.Time, wait time.Duration, timedOut bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.disconnectedAt.IsZero() {
		end := s.finishedAt
		if end.IsZero() {
			end = time.Now()
		}
		wait = max(0, end.Sub(s.disconnectedAt))
	}
	return s.disconnectedAt, wait, s.timedOut
}
