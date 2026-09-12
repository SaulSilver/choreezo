package auth

import (
	"context"
	"fmt"

	firebaseauth "firebase.google.com/go/v4/auth"
)

type FirebaseTokenVerifier struct {
	client *firebaseauth.Client
}

func NewFirebaseTokenVerifier(client *firebaseauth.Client) *FirebaseTokenVerifier {
	if client == nil {
		return nil
	}
	return &FirebaseTokenVerifier{client: client}
}

func (v *FirebaseTokenVerifier) VerifyIDToken(ctx context.Context, idToken string) (*Identity, error) {
	if v == nil || v.client == nil {
		return nil, fmt.Errorf("firebase auth client is not configured")
	}

	token, err := v.client.VerifyIDToken(ctx, idToken)
	if err != nil {
		return nil, err
	}
	if token.UID == "" {
		return nil, fmt.Errorf("firebase token missing uid")
	}

	return &Identity{UID: token.UID}, nil
}
