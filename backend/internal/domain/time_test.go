package domain

import (
	"testing"
	"time"
)

func TestWeekDatesUsesISOWeekYear(t *testing.T) {
	dates, err := WeekDates(202101)
	if err != nil {
		t.Fatalf("WeekDates() error = %v", err)
	}
	if got, want := FormatDate(dates[0]), "2021-01-04"; got != want {
		t.Fatalf("expected first date %s, got %s", want, got)
	}
	if got, want := FormatDate(dates[6]), "2021-01-10"; got != want {
		t.Fatalf("expected last date %s, got %s", want, got)
	}
}

func TestISOWeekNumberAtTimeZoneBoundaries(t *testing.T) {
	madrid, err := time.LoadLocation("Europe/Madrid")
	if err != nil {
		t.Fatalf("LoadLocation() error = %v", err)
	}
	newYork, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatalf("LoadLocation() error = %v", err)
	}

	cases := []struct {
		name string
		when time.Time
		loc  *time.Location
		want int
	}{
		{
			name: "utc late sunday stays prior iso year",
			when: time.Date(2021, time.January, 3, 23, 30, 0, 0, time.UTC),
			loc:  time.UTC,
			want: 202053,
		},
		{
			name: "utc monday enters new iso week",
			when: time.Date(2021, time.January, 4, 0, 30, 0, 0, time.UTC),
			loc:  time.UTC,
			want: 202101,
		},
		{
			name: "madrid monday boundary",
			when: time.Date(2021, time.January, 4, 0, 30, 0, 0, time.UTC),
			loc:  madrid,
			want: 202101,
		},
		{
			name: "new york still sunday boundary",
			when: time.Date(2021, time.January, 4, 0, 30, 0, 0, time.UTC),
			loc:  newYork,
			want: 202053,
		},
		{
			name: "madrid monday after utc sunday night",
			when: time.Date(2021, time.January, 10, 23, 30, 0, 0, time.UTC),
			loc:  madrid,
			want: 202102,
		},
		{
			name: "new york sunday stays same week",
			when: time.Date(2021, time.January, 10, 23, 30, 0, 0, time.UTC),
			loc:  newYork,
			want: 202101,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ISOWeekNumberAt(tc.when, tc.loc); got != tc.want {
				t.Fatalf("ISOWeekNumberAt() = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestDeterministicAssignmentID(t *testing.T) {
	if got, want := DeterministicAssignmentID("2026-01-05", "chore-1"), "2026-01-05_chore-1"; got != want {
		t.Fatalf("DeterministicAssignmentID() = %q, want %q", got, want)
	}
}
