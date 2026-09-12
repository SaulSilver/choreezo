package httpapi

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/SaulSilver/choreezo/backend/internal/auth"
)

type Dependencies struct {
	Logger           *slog.Logger
	FirebaseVerifier auth.FirebaseVerifier
	InternalVerifier auth.InternalVerifier
}

func NewHandler(deps Dependencies) http.Handler {
	logger := deps.Logger
	if logger == nil {
		logger = slog.Default()
	}

	app := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/healthz":
			writeHealth(w)
		case strings.HasPrefix(r.URL.Path, "/v1/"):
			firebaseProtectedHandler(deps.FirebaseVerifier).ServeHTTP(w, r)
		case strings.HasPrefix(r.URL.Path, "/internal/"):
			internalProtectedHandler(deps.InternalVerifier).ServeHTTP(w, r)
		default:
			WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		}
	})

	return withRecovery(logger, withRequestID(withLogging(logger, app)))
}

func firebaseProtectedHandler(verifier auth.FirebaseVerifier) http.Handler {
	notImplemented := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		WriteError(w, r, http.StatusServiceUnavailable, "not_implemented", "endpoint is not implemented in Phase A")
	})
	return auth.FirebaseMiddleware(verifier, WriteError)(notImplemented)
}

func internalProtectedHandler(verifier auth.InternalVerifier) http.Handler {
	notImplemented := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		WriteError(w, r, http.StatusServiceUnavailable, "not_implemented", "endpoint is not implemented in Phase A")
	})
	return auth.InternalMiddleware(verifier, WriteError)(notImplemented)
}
