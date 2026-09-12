package config

import "testing"

func TestLoadDefaults(t *testing.T) {
	t.Setenv("PORT", "")
	t.Setenv("FIREBASE_PROJECT_ID", "demo-project")
	t.Setenv("GOOGLE_CLOUD_PROJECT", "")
	t.Setenv("GOOGLE_APPLICATION_CREDENTIALS", "")
	t.Setenv("FIRESTORE_EMULATOR_HOST", "localhost:8080")
	t.Setenv("LOG_LEVEL", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Port != defaultPort {
		t.Fatalf("expected default port %q, got %q", defaultPort, cfg.Port)
	}

	if cfg.LogLevel != LogLevelInfo {
		t.Fatalf("expected default log level %q, got %q", LogLevelInfo, cfg.LogLevel)
	}
}

func TestValidateMissingProjectID(t *testing.T) {
	cfg := Config{Port: defaultPort, LogLevel: LogLevelInfo}

	err := cfg.Validate()
	if err == nil {
		t.Fatal("expected validation error")
	}

	if got := err.Error(); got != "FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT is required" {
		t.Fatalf("unexpected error: %s", got)
	}
}

func TestValidateRejectsInvalidValues(t *testing.T) {
	cfg := Config{Port: "abc", ProjectID: "demo-project", LogLevel: LogLevel("trace")}

	err := cfg.Validate()
	if err == nil {
		t.Fatal("expected validation error")
	}

	want := "PORT must be numeric; LOG_LEVEL must be one of debug, info, warn, error"
	if err.Error() != want {
		t.Fatalf("unexpected error: got %q want %q", err.Error(), want)
	}
}
