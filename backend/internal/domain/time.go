package domain

import (
	"fmt"
	"time"
)

const dateLayout = "2006-01-02"

func FormatDate(value time.Time) string {
	return value.UTC().Format(dateLayout)
}

func ISOWeekNumberAt(value time.Time, loc *time.Location) int {
	if loc == nil {
		loc = time.UTC
	}
	local := value.In(loc)
	anchor := time.Date(local.Year(), local.Month(), local.Day(), 12, 0, 0, 0, loc)
	year, week := anchor.ISOWeek()
	return year*100 + week
}

func WeekDates(weekNumber int) ([]time.Time, error) {
	year := weekNumber / 100
	week := weekNumber % 100
	if year < 1 || week < 1 || week > 53 {
		return nil, fmt.Errorf("invalid week number %d", weekNumber)
	}

	jan4 := time.Date(year, time.January, 4, 12, 0, 0, 0, time.UTC)
	weekday := int(jan4.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	start := jan4.AddDate(0, 0, -(weekday-1)+(week-1)*7)

	dates := make([]time.Time, 0, 7)
	for i := 0; i < 7; i++ {
		dates = append(dates, start.AddDate(0, 0, i))
	}
	return dates, nil
}

func DeterministicAssignmentID(date string, choreID string) string {
	return fmt.Sprintf("%s_%s", date, choreID)
}
