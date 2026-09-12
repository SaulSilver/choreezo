package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/SaulSilver/choreezo/backend/internal/config"
	appfirestore "github.com/SaulSilver/choreezo/backend/internal/firestore"
	apihttp "github.com/SaulSilver/choreezo/backend/internal/http"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load configuration", slog.String("error", err.Error()))
		os.Exit(1)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel.Level()}))
	logger.Info("starting backend",
		slog.String("addr", cfg.HTTPAddress()),
		slog.String("project_id", cfg.ProjectID),
		slog.Bool("firestore_emulator", cfg.FirestoreEmulatorHost != ""),
		slog.String("log_level", cfg.LogLevel.String()),
	)

	clients, err := appfirestore.New(ctx, cfg)
	if err != nil {
		logger.Error("failed to initialize firebase", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer func() {
		if closeErr := clients.Close(); closeErr != nil {
			logger.Warn("failed to close firestore client", slog.String("error", closeErr.Error()))
		}
	}()

	handler := apihttp.NewHandler(apihttp.Dependencies{
		Logger: logger,
	})

	server := &http.Server{
		Addr:              cfg.HTTPAddress(),
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	serverErrors := make(chan error, 1)
	go func() {
		logger.Info("http server listening")
		if serveErr := server.ListenAndServe(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			serverErrors <- serveErr
		}
		close(serverErrors)
	}()

	select {
	case <-ctx.Done():
		logger.Info("shutdown signal received")
	case serveErr, ok := <-serverErrors:
		if ok && serveErr != nil {
			logger.Error("http server failed", slog.String("error", serveErr.Error()))
			os.Exit(1)
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", slog.String("error", err.Error()))
		os.Exit(1)
	}

	logger.Info("server stopped")
}
