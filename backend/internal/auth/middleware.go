package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
)

var ErrMissingBearerToken = errors.New("missing bearer token")

type contextKey string

const identityContextKey contextKey = "firebase_identity"

type Identity struct {
	UID string
}

type FirebaseVerifier interface {
	VerifyIDToken(ctx context.Context, idToken string) (*Identity, error)
}

type InternalVerifier interface {
	VerifyRequest(ctx context.Context, r *http.Request) error
}

func IdentityFromContext(ctx context.Context) (*Identity, bool) {
	identity, ok := ctx.Value(identityContextKey).(*Identity)
	if !ok || identity == nil || identity.UID == "" {
		return nil, false
	}
	return identity, true
}

func FirebaseMiddleware(verifier FirebaseVerifier, onError func(http.ResponseWriter, *http.Request, int, string, string)) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, err := bearerToken(r.Header.Get("Authorization"))
			if err != nil {
				onError(w, r, http.StatusUnauthorized, "unauthorized", "missing or invalid bearer token")
				return
			}
			if verifier == nil {
				onError(w, r, http.StatusServiceUnavailable, "auth_unavailable", "firebase authentication is not configured")
				return
			}
			identity, err := verifier.VerifyIDToken(r.Context(), token)
			if err != nil {
				onError(w, r, http.StatusUnauthorized, "unauthorized", "invalid authentication token")
				return
			}
			ctx := context.WithValue(r.Context(), identityContextKey, identity)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func InternalMiddleware(verifier InternalVerifier, onError func(http.ResponseWriter, *http.Request, int, string, string)) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if verifier == nil {
				onError(w, r, http.StatusServiceUnavailable, "internal_auth_unavailable", "internal endpoint authentication is not configured")
				return
			}
			if err := verifier.VerifyRequest(r.Context(), r); err != nil {
				onError(w, r, http.StatusUnauthorized, "unauthorized", "invalid internal authentication")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func bearerToken(value string) (string, error) {
	const prefix = "Bearer "
	if !strings.HasPrefix(value, prefix) {
		return "", ErrMissingBearerToken
	}

	token := strings.TrimSpace(strings.TrimPrefix(value, prefix))
	if token == "" {
		return "", ErrMissingBearerToken
	}
	return token, nil
}
