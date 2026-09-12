package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthz(t *testing.T) {
	handler := NewHandler(Dependencies{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body.Status != "ok" {
		t.Fatalf("expected status body ok, got %q", body.Status)
	}
	if res.Header().Get("X-Request-Id") == "" {
		t.Fatal("expected X-Request-Id header")
	}
}

func TestNotFoundErrorEnvelope(t *testing.T) {
	handler := NewHandler(Dependencies{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	req := httptest.NewRequest(http.MethodGet, "/missing", nil)
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, res.Code)
	}

	var body struct {
		Error struct {
			Code      string `json:"code"`
			Message   string `json:"message"`
			RequestID string `json:"requestId"`
		} `json:"error"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body.Error.Code != "not_found" {
		t.Fatalf("expected error code not_found, got %q", body.Error.Code)
	}
	if body.Error.RequestID == "" {
		t.Fatal("expected requestId in error response")
	}
}

func TestProtectedEndpointRequiresBearerToken(t *testing.T) {
	handler := NewHandler(Dependencies{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	req := httptest.NewRequest(http.MethodGet, "/v1/profile", nil)
	req.Header.Set("Authorization", "Bearer")
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, res.Code)
	}

	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body.Error.Code != "unauthorized" {
		t.Fatalf("expected error code unauthorized, got %q", body.Error.Code)
	}
}

func TestRequestIDIncludedInLogs(t *testing.T) {
	var logs bytes.Buffer
	handler := NewHandler(Dependencies{Logger: slog.New(slog.NewJSONHandler(&logs, nil))})
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if !strings.Contains(logs.String(), "\"request_id\":\"") {
		t.Fatalf("expected request_id field in logs, got %s", logs.String())
	}
	if strings.Contains(logs.String(), "\"request_id\":\"\"") {
		t.Fatalf("expected non-empty request_id in logs, got %s", logs.String())
	}
}
