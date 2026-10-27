package api

import (
	"sync"
	"time"
)

const rateLimitEntriesCleanupThreshold = 4096

type fixedWindowEntry struct {
	start time.Time
	count int
}

type fixedWindowLimiter struct {
	mu      sync.Mutex
	limit   int
	window  time.Duration
	entries map[string]fixedWindowEntry
	now     func() time.Time
}

func newFixedWindowLimiter(limit int, window time.Duration, now func() time.Time) *fixedWindowLimiter {
	if now == nil {
		now = time.Now
	}
	return &fixedWindowLimiter{
		limit:   limit,
		window:  window,
		entries: make(map[string]fixedWindowEntry),
		now:     now,
	}
}

func (l *fixedWindowLimiter) Allow(key string) bool {
	if l == nil || key == "" {
		return true
	}
	current := l.now()
	l.mu.Lock()
	defer l.mu.Unlock()

	if len(l.entries) >= rateLimitEntriesCleanupThreshold {
		for candidate, entry := range l.entries {
			if current.Sub(entry.start) >= l.window {
				delete(l.entries, candidate)
			}
		}
	}

	entry, found := l.entries[key]
	if !found || current.Sub(entry.start) >= l.window {
		l.entries[key] = fixedWindowEntry{start: current, count: 1}
		return true
	}
	if entry.count >= l.limit {
		return false
	}
	entry.count++
	l.entries[key] = entry
	return true
}
