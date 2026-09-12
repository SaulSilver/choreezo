package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/SaulSilver/choreezo/backend/internal/auth"
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

func TestProtectedEndpointReturnsPhaseAPlaceholderAfterAuth(t *testing.T) {
	handler := NewHandler(Dependencies{
		Logger:           slog.New(slog.NewTextHandler(io.Discard, nil)),
		FirebaseVerifier: staticFirebaseVerifier{},
	})
	req := httptest.NewRequest(http.MethodGet, "/v1/profile", nil)
	req.Header.Set("Authorization", strings.Join([]string{"Bearer", "token"}, " "))
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, res.Code)
	}

	var body struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body.Error.Code != "not_implemented" {
		t.Fatalf("expected error code not_implemented, got %q", body.Error.Code)
	}
	if body.Error.Message != "endpoint is not implemented in Phase A" {
		t.Fatalf("unexpected error message %q", body.Error.Message)
	}
}

func TestInternalEndpointReturnsPhaseAPlaceholderAfterAuth(t *testing.T) {
	handler := NewHandler(Dependencies{
		Logger:           slog.New(slog.NewTextHandler(io.Discard, nil)),
		InternalVerifier: staticInternalVerifier{},
	})
	req := httptest.NewRequest(http.MethodPost, "/internal/jobs/weekly-seed", nil)
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, res.Code)
	}

	var body struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body.Error.Code != "not_implemented" {
		t.Fatalf("expected error code not_implemented, got %q", body.Error.Code)
	}
	if body.Error.Message != "endpoint is not implemented in Phase A" {
		t.Fatalf("unexpected error message %q", body.Error.Message)
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

type staticFirebaseVerifier struct{}

func (staticFirebaseVerifier) VerifyIDToken(_ context.Context, _ string) (*auth.Identity, error) {
	return &auth.Identity{UID: "user-123"}, nil
}

type staticInternalVerifier struct{}

func (staticInternalVerifier) VerifyRequest(_ context.Context, _ *http.Request) error {
	return nil
}
