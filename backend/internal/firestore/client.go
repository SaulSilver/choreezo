package firestore

import (
	"context"

	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"

	"github.com/SaulSilver/choreezo/backend/internal/config"
)

type Clients struct {
	App       *firebase.App
	Firestore interface{ Close() error }
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

	client, err := app.Firestore(ctx)
	if err != nil {
		return nil, err
	}

	return &Clients{
		App:       app,
		Firestore: client,
	}, nil
}

func (c *Clients) Close() error {
	if c == nil || c.Firestore == nil {
		return nil
	}
	return c.Firestore.Close()
}
