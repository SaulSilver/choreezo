package firestore

import (
	"context"

	gofirestore "cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	firebaseauth "firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"

	"github.com/SaulSilver/choreezo/backend/internal/config"
)

type Clients struct {
	App       *firebase.App
	Auth      *firebaseauth.Client
	Firestore *gofirestore.Client
}

func New(ctx context.Context, cfg config.Config) (*Clients, error) {
	var opts []option.ClientOption
	if cfg.CredentialsFile != "" {
		opts = append(opts, option.WithCredentialsFile(cfg.CredentialsFile))
	}

	app, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: cfg.ProjectID}, opts...)
	if err != nil {
		return nil, err
	}

	authClient, err := app.Auth(ctx)
	if err != nil {
		return nil, err
	}

	client, err := app.Firestore(ctx)
	if err != nil {
		return nil, err
	}

	return &Clients{
		App:       app,
		Auth:      authClient,
		Firestore: client,
	}, nil
}

func (c *Clients) Close() error {
	if c == nil || c.Firestore == nil {
		return nil
	}
	return c.Firestore.Close()
}
