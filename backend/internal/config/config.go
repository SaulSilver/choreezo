package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
)

const (
	defaultPort     = "8080"
	defaultLogLevel = "info"
)

type LogLevel string

const (
	LogLevelDebug LogLevel = "debug"
	LogLevelInfo  LogLevel = "info"
	LogLevelWarn  LogLevel = "warn"
	LogLevelError LogLevel = "error"
)

type Config struct {
	Port                  string
	ProjectID             string
	CredentialsFile       string
	FirestoreEmulatorHost string
	LogLevel              LogLevel
}

func Load() (Config, error) {
	cfg := Config{
		Port:                  strings.TrimSpace(firstNonEmpty(os.Getenv("PORT"), defaultPort)),
		ProjectID:             strings.TrimSpace(firstNonEmpty(os.Getenv("FIREBASE_PROJECT_ID"), os.Getenv("GOOGLE_CLOUD_PROJECT"))),
		CredentialsFile:       strings.TrimSpace(os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")),
		FirestoreEmulatorHost: strings.TrimSpace(os.Getenv("FIRESTORE_EMULATOR_HOST")),
		LogLevel:              LogLevel(strings.ToLower(strings.TrimSpace(firstNonEmpty(os.Getenv("LOG_LEVEL"), defaultLogLevel)))),
	}

	return cfg, cfg.Validate()
}

func (c Config) Validate() error {
	var problems []string

	if c.ProjectID == "" {
		problems = append(problems, "FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT is required")
	}

	if _, err := strconv.Atoi(c.Port); err != nil {
		problems = append(problems, "PORT must be numeric")
	}

	if c.LogLevel.Level() == nil {
		problems = append(problems, "LOG_LEVEL must be one of debug, info, warn, error")
	}

	if len(problems) > 0 {
		return errors.New(strings.Join(problems, "; "))
	}

	return nil
}

func (c Config) HTTPAddress() string {
	return fmt.Sprintf(":%s", c.Port)
}

func (l LogLevel) Level() slog.Leveler {
	switch l {
	case LogLevelDebug:
		return slog.LevelDebug
	case LogLevelInfo:
		return slog.LevelInfo
	case LogLevelWarn:
		return slog.LevelWarn
	case LogLevelError:
		return slog.LevelError
	default:
		return nil
	}
}

func (l LogLevel) String() string {
	if l == "" {
		return defaultLogLevel
	}
	return string(l)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
