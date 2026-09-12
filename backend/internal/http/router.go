package httpapi

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/SaulSilver/choreezo/backend/internal/auth"
	"github.com/SaulSilver/choreezo/backend/internal/domain"
)

type Dependencies struct {
	Logger           *slog.Logger
	FirebaseVerifier auth.FirebaseVerifier
	InternalVerifier auth.InternalVerifier
	DomainService    domain.API
}

func NewHandler(deps Dependencies) http.Handler {
	logger := deps.Logger
	if logger == nil {
		logger = slog.Default()
	}
	firebaseHandler := firebaseProtectedHandler(deps.FirebaseVerifier, deps.DomainService)
	internalHandler := internalProtectedHandler(deps.InternalVerifier)

	app := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/healthz":
			writeHealth(w)
		case strings.HasPrefix(r.URL.Path, "/v1/"):
			firebaseHandler.ServeHTTP(w, r)
		case r.Method == http.MethodPost && r.URL.Path == "/internal/jobs/weekly-seed":
			internalHandler.ServeHTTP(w, r)
		default:
			WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		}
	})

	return withRecovery(logger, withRequestID(withLogging(logger, app)))
}

func firebaseProtectedHandler(verifier auth.FirebaseVerifier, service domain.API) http.Handler {
	return auth.FirebaseMiddleware(verifier, WriteError)(newV1Handler(service))
}

func internalProtectedHandler(verifier auth.InternalVerifier) http.Handler {
	notImplemented := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		WriteError(w, r, http.StatusServiceUnavailable, "not_implemented", "endpoint is not implemented in Phase A")
	})
	return auth.InternalMiddleware(verifier, WriteError)(notImplemented)
}
