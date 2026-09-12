package domain

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sort"
	"sync"
	"testing"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"
)

func TestCreateApartmentTransactionAndInviteCollisionRetry(t *testing.T) {
	ctx, service, client := newEmulatorService(t)
	seedUser(t, ctx, client, "owner", map[string]any{
		"name":         "Owner",
		"notifyDaily":  true,
		"notifyWeekly": true,
	})
	seedInviteMapping(t, ctx, client, "ABC123", "existing-apartment")

	codes := []string{"ABC123", "Z9Y8X7"}
	service.inviteCodeGenerator = func() string {
		code := codes[0]
		codes = codes[1:]
		return code
	}

	apartment, err := service.CreateApartment(ctx, "owner", CreateApartmentInput{Name: "The Loft", Timezone: "Europe/Madrid"})
	if err != nil {
		t.Fatalf("CreateApartment() error = %v", err)
	}
	if apartment.InviteCode != "Z9Y8X7" {
		t.Fatalf("expected retried invite code, got %q", apartment.InviteCode)
	}
	if apartment.Timezone != "Europe/Madrid" {
		t.Fatalf("expected timezone Europe/Madrid, got %q", apartment.Timezone)
	}

	owner := mustGetProfile(t, ctx, service, "owner")
	if owner.ApartmentID == nil || *owner.ApartmentID != apartment.ID {
		t.Fatalf("expected owner apartmentId %q, got %#v", apartment.ID, owner.ApartmentID)
	}

	chores := listChoresRaw(t, ctx, client, apartment.ID)
	if got, want := len(chores), len(defaultChores); got != want {
		t.Fatalf("expected %d default chores, got %d", want, got)
	}

	mappingSnap, err := client.Collection(inviteMappingsCollection).Doc(apartment.InviteCode).Get(ctx)
	if err != nil {
		t.Fatalf("mapping lookup error = %v", err)
	}
	mapping := map[string]any{}
	if err := mappingSnap.DataTo(&mapping); err != nil {
		t.Fatalf("mapping decode error = %v", err)
	}
	if mapping["apartmentId"] != apartment.ID {
		t.Fatalf("expected mapping apartmentId %q, got %#v", apartment.ID, mapping["apartmentId"])
	}
}

func TestJoinApartmentNormalizesInviteCodeAndRateLimits(t *testing.T) {
	ctx, service, client := newEmulatorService(t)
	seedUser(t, ctx, client, "owner", map[string]any{"name": "Owner"})
	seedUser(t, ctx, client, "joiner", map[string]any{"name": "Joiner"})
	apartment := seedApartment(t, ctx, client, "apt-1", map[string]any{
		"name":       "Apt",
		"inviteCode": "QWERTY",
		"timezone":   "UTC",
		"createdBy":  "owner",
	})
	seedInviteMapping(t, ctx, client, "QWERTY", apartment.ID)

	joined, err := service.JoinApartment(ctx, "joiner", JoinApartmentInput{InviteCode: "qwerty"})
	if err != nil {
		t.Fatalf("JoinApartment() error = %v", err)
	}
	if joined.ID != apartment.ID {
		t.Fatalf("expected apartment %q, got %q", apartment.ID, joined.ID)
	}

	joinedAgain, err := service.JoinApartment(ctx, "joiner", JoinApartmentInput{InviteCode: "QWERTY"})
	if err != nil {
		t.Fatalf("JoinApartment() idempotent retry error = %v", err)
	}
	if joinedAgain.ID != apartment.ID {
		t.Fatalf("expected apartment %q, got %q", apartment.ID, joinedAgain.ID)
	}

	seedUser(t, ctx, client, "rate-limited", map[string]any{"name": "Rate Limited"})
	for attempt := 0; attempt < inviteRateLimit; attempt++ {
		_, err := service.JoinApartment(ctx, "rate-limited", JoinApartmentInput{InviteCode: "NOPE99"})
		if err == nil {
			t.Fatalf("expected invalid invite error on attempt %d", attempt+1)
		}
		var domainErr *Error
		if !errors.As(err, &domainErr) || domainErr.Code != "invalid_invite_code" {
			t.Fatalf("expected invalid_invite_code, got %v", err)
		}
	}
	_, err = service.JoinApartment(ctx, "rate-limited", JoinApartmentInput{InviteCode: "NOPE99"})
	var domainErr *Error
	if !errors.As(err, &domainErr) || domainErr.Code != "invite_rate_limited" {
		t.Fatalf("expected invite_rate_limited, got %v", err)
	}
}

func TestConcurrentJoinIsIdempotent(t *testing.T) {
	ctx, service, client := newEmulatorService(t)
	seedUser(t, ctx, client, "owner", map[string]any{"name": "Owner"})
	seedUser(t, ctx, client, "joiner", map[string]any{"name": "Joiner"})
	apartment := seedApartment(t, ctx, client, "apt-1", map[string]any{
		"name":       "Apt",
		"inviteCode": "JOINME",
		"timezone":   "UTC",
		"createdBy":  "owner",
	})
	seedInviteMapping(t, ctx, client, "JOINME", apartment.ID)

	errCh := make(chan error, 2)
	var wg sync.WaitGroup
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := service.JoinApartment(ctx, "joiner", JoinApartmentInput{InviteCode: "joinme"})
			errCh <- err
		}()
	}
	wg.Wait()
	close(errCh)

	for err := range errCh {
		if err != nil {
			t.Fatalf("concurrent JoinApartment() error = %v", err)
		}
	}
	joiner := mustGetProfile(t, ctx, service, "joiner")
	if joiner.ApartmentID == nil || *joiner.ApartmentID != apartment.ID {
		t.Fatalf("expected joiner apartmentId %q, got %#v", apartment.ID, joiner.ApartmentID)
	}
}

func TestApartmentMembershipRules(t *testing.T) {
	ctx, service, client := newEmulatorService(t)
	seedUser(t, ctx, client, "owner", map[string]any{"name": "Owner", "apartmentId": "apt-1"})
	seedUser(t, ctx, client, "outsider", map[string]any{"name": "Outsider"})
	seedApartment(t, ctx, client, "apt-1", map[string]any{
		"name":       "Apt",
		"inviteCode": "MEMBER",
		"timezone":   "UTC",
		"createdBy":  "owner",
	})

	if _, err := service.GetApartment(ctx, "outsider", "apt-1"); err == nil {
		t.Fatal("expected not found for outsider")
	} else if !hasDomainCode(err, "not_found") {
		t.Fatalf("expected not_found for outsider, got %v", err)
	}
}

func TestCreateDemoApartmentAndClearDemo(t *testing.T) {
	ctx, service, client := newEmulatorService(t)
	seedUser(t, ctx, client, "owner", map[string]any{"name": "Owner", "notifyDaily": true, "notifyWeekly": true})
	service.inviteCodeGenerator = func() string { return "DEMO12" }

	apartment, err := service.CreateDemoApartment(ctx, "owner")
	if err != nil {
		t.Fatalf("CreateDemoApartment() error = %v", err)
	}
	if !apartment.IsDemo {
		t.Fatal("expected demo apartment")
	}
	members, err := service.GetApartmentMembers(ctx, "owner", apartment.ID)
	if err != nil {
		t.Fatalf("GetApartmentMembers() error = %v", err)
	}
	if got, want := len(members), 4; got != want {
		t.Fatalf("expected %d members, got %d", want, got)
	}

	weekNumber := ISOWeekNumberAt(service.now(), time.UTC)
	assignments, err := service.GetAssignmentsForWeek(ctx, "owner", apartment.ID, weekNumber)
	if err != nil {
		t.Fatalf("GetAssignmentsForWeek() error = %v", err)
	}
	if len(assignments) == 0 {
		t.Fatal("expected demo assignments to be seeded")
	}

	if err := service.ClearDemoApartment(ctx, "owner", apartment.ID); err != nil {
		t.Fatalf("ClearDemoApartment() error = %v", err)
	}
	assertDocumentMissing(t, ctx, client.Collection(apartmentsCollection).Doc(apartment.ID))
	assertDocumentMissing(t, ctx, client.Collection(usersCollection).Doc(fmt.Sprintf("%s-demo-1", apartment.ID)))
	owner := mustGetProfile(t, ctx, service, "owner")
	if owner.ApartmentID != nil {
		t.Fatalf("expected owner apartmentId to be cleared, got %#v", owner.ApartmentID)
	}
}

func TestDeleteApartmentRecursivelyDeletesSubcollections(t *testing.T) {
	ctx, service, client := newEmulatorService(t)
	seedUser(t, ctx, client, "owner", map[string]any{"name": "Owner", "apartmentId": "apt-1"})
	seedUser(t, ctx, client, "member", map[string]any{"name": "Member", "apartmentId": "apt-1"})
	apartment := seedApartment(t, ctx, client, "apt-1", map[string]any{
		"name":       "Apt",
		"inviteCode": "DEL123",
		"timezone":   "UTC",
		"createdBy":  "owner",
	})
	seedInviteMapping(t, ctx, client, apartment.InviteCode, apartment.ID)
	seedChore(t, ctx, client, apartment.ID, "chore-1", map[string]any{"name": "Dinner"})
	seedAssignment(t, ctx, client, apartment.ID, "assignment-1", map[string]any{
		"apartmentId": apartment.ID,
		"choreId":     "chore-1",
		"date":        "2026-01-05",
		"weekNumber":  202602,
		"userId":      "member",
	})

	if err := service.DeleteApartment(ctx, "owner", apartment.ID); err != nil {
		t.Fatalf("DeleteApartment() error = %v", err)
	}
	assertDocumentMissing(t, ctx, client.Collection(apartmentsCollection).Doc(apartment.ID))
	assertDocumentMissing(t, ctx, client.Collection(inviteMappingsCollection).Doc(apartment.InviteCode))
	if got := len(listChoresRaw(t, ctx, client, apartment.ID)); got != 0 {
		t.Fatalf("expected chores to be deleted, got %d", got)
	}
	if got := len(listAssignmentsRaw(t, ctx, client, apartment.ID)); got != 0 {
		t.Fatalf("expected assignments to be deleted, got %d", got)
	}
	for _, uid := range []string{"owner", "member"} {
		profile := mustGetProfile(t, ctx, service, uid)
		if profile.ApartmentID != nil {
			t.Fatalf("expected %s apartmentId cleared, got %#v", uid, profile.ApartmentID)
		}
	}
}

func TestDeleteProfilePreservesCurrentBehavior(t *testing.T) {
	ctx, service, client := newEmulatorService(t)
	seedUser(t, ctx, client, "owner", map[string]any{"name": "Owner", "apartmentId": "apt-1"})
	seedUser(t, ctx, client, "member", map[string]any{"name": "Member", "apartmentId": "apt-1"})
	seedApartment(t, ctx, client, "apt-1", map[string]any{
		"name":       "Apt",
		"inviteCode": "KEEPIT",
		"timezone":   "UTC",
		"createdBy":  "owner",
	})
	seedAssignment(t, ctx, client, "apt-1", "assignment-1", map[string]any{
		"apartmentId": "apt-1",
		"choreId":     "chore-1",
		"date":        "2026-01-05",
		"weekNumber":  202602,
		"userId":      "member",
	})
	seedDevice(t, ctx, client, "member", "device-1", map[string]any{"deviceId": "device-1", "expoPushToken": "ExponentPushToken[member]", "enabled": true})

	if err := service.DeleteProfile(ctx, "member"); err != nil {
		t.Fatalf("DeleteProfile() error = %v", err)
	}
	assertDocumentMissing(t, ctx, client.Collection(usersCollection).Doc("member"))
	assertDocumentMissing(t, ctx, client.Collection(usersCollection).Doc("member").Collection(deviceRegistrationsCollection).Doc("device-1"))
	if _, err := client.Collection(apartmentsCollection).Doc("apt-1").Collection(assignmentsCollection).Doc("assignment-1").Get(ctx); err != nil {
		t.Fatalf("expected assignment to remain after member deletion, got %v", err)
	}

	if err := service.DeleteProfile(ctx, "owner"); err == nil {
		t.Fatal("expected owner deletion to be blocked")
	} else if !hasDomainCode(err, "apartment_owner_conflict") {
		t.Fatalf("expected apartment_owner_conflict, got %v", err)
	}
}

func TestDeviceRegistrationSupportsMultipleDevices(t *testing.T) {
	ctx, service, client := newEmulatorService(t)
	seedUser(t, ctx, client, "user-1", map[string]any{"name": "User"})

	if err := service.RegisterDevice(ctx, "user-1", RegisterDeviceInput{DeviceID: "device-1", ExpoPushToken: "ExponentPushToken[token-1]"}); err != nil {
		t.Fatalf("RegisterDevice() error = %v", err)
	}
	if err := service.RegisterDevice(ctx, "user-1", RegisterDeviceInput{DeviceID: "device-2", ExpoPushToken: "ExponentPushToken[token-2]"}); err != nil {
		t.Fatalf("RegisterDevice() second error = %v", err)
	}

	profile := mustGetProfile(t, ctx, service, "user-1")
	if profile.ID != "user-1" {
		t.Fatalf("expected profile id user-1, got %q", profile.ID)
	}

	if err := service.UnregisterDevice(ctx, "user-1", "device-2"); err != nil {
		t.Fatalf("UnregisterDevice() error = %v", err)
	}
	doc, err := client.Collection(usersCollection).Doc("user-1").Get(ctx)
	if err != nil {
		t.Fatalf("user lookup error = %v", err)
	}
	data := doc.Data()
	if got := data["expoPushToken"]; got != "ExponentPushToken[token-1]" {
		t.Fatalf("expected fallback token-1, got %#v", got)
	}
}

func TestAssignmentStateTransitionsAndValidation(t *testing.T) {
	ctx, service, client := newEmulatorService(t)
	setupApartmentFixture(t, ctx, client, "apt-1", []string{"owner", "member"})
	seedAssignment(t, ctx, client, "apt-1", "assignment-1", map[string]any{
		"apartmentId": "apt-1",
		"choreId":     "chore-1",
		"date":        "2026-01-05",
		"weekNumber":  202602,
		"userId":      nil,
	})

	claimed, err := service.ClaimAssignment(ctx, "owner", "apt-1", "assignment-1")
	if err != nil {
		t.Fatalf("ClaimAssignment() error = %v", err)
	}
	if claimed.UserID == nil || *claimed.UserID != "owner" || !claimed.ManuallyAssigned {
		t.Fatalf("unexpected claimed assignment: %#v", claimed)
	}

	if _, err := service.ClaimAssignment(ctx, "member", "apt-1", "assignment-1"); err == nil {
		t.Fatal("expected claim conflict")
	} else if !hasDomainCode(err, "assignment_already_claimed") {
		t.Fatalf("expected assignment_already_claimed, got %v", err)
	}

	unclaimed, err := service.UnclaimAssignment(ctx, "owner", "apt-1", "assignment-1")
	if err != nil {
		t.Fatalf("UnclaimAssignment() error = %v", err)
	}
	if unclaimed.UserID != nil || unclaimed.ManuallyAssigned {
		t.Fatalf("expected unclaimed assignment, got %#v", unclaimed)
	}

	target := "member"
	assigned, err := service.SetAssignmentUser(ctx, "owner", "apt-1", "assignment-1", &target)
	if err != nil {
		t.Fatalf("SetAssignmentUser() error = %v", err)
	}
	if assigned.UserID == nil || *assigned.UserID != "member" || !assigned.ManuallyAssigned {
		t.Fatalf("expected assigned member, got %#v", assigned)
	}

	if _, err := service.UnclaimAssignment(ctx, "owner", "apt-1", "assignment-1"); err == nil {
		t.Fatal("expected unclaim conflict for different user")
	} else if !hasDomainCode(err, "assignment_not_claimed_by_user") {
		t.Fatalf("expected assignment_not_claimed_by_user, got %v", err)
	}

	invalidTarget := "outsider"
	seedUser(t, ctx, client, invalidTarget, map[string]any{"name": "Outsider"})
	if _, err := service.SetAssignmentUser(ctx, "owner", "apt-1", "assignment-1", &invalidTarget); err == nil {
		t.Fatal("expected invalid assignment target")
	} else if !hasDomainCode(err, "invalid_assignment_target") {
		t.Fatalf("expected invalid_assignment_target, got %v", err)
	}
}

func TestEnsureAssignmentsSupportsLegacyRecordsAndConcurrency(t *testing.T) {
	ctx, service, client := newEmulatorService(t)
	setupApartmentFixture(t, ctx, client, "apt-1", []string{"owner", "member"})
	weekNumber := 202602
	legacyID := "legacy-random-id"
	seedAssignment(t, ctx, client, "apt-1", legacyID, map[string]any{
		"apartmentId":      "apt-1",
		"choreId":          "chore-1",
		"date":             "2026-01-05",
		"weekNumber":       weekNumber,
		"userId":           "member",
		"manuallyAssigned": true,
	})

	errCh := make(chan error, 2)
	var wg sync.WaitGroup
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := service.EnsureAssignmentsForWeek(ctx, "owner", "apt-1", weekNumber)
			errCh <- err
		}()
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		if err != nil {
			t.Fatalf("EnsureAssignmentsForWeek() error = %v", err)
		}
	}

	assignments, err := service.GetAssignmentsForWeek(ctx, "owner", "apt-1", weekNumber)
	if err != nil {
		t.Fatalf("GetAssignmentsForWeek() error = %v", err)
	}
	if got, want := len(assignments), 14; got != want {
		t.Fatalf("expected %d assignments, got %d", want, got)
	}
	var sawLegacy bool
	for _, assignment := range assignments {
		if assignment.ID == legacyID {
			sawLegacy = true
			if assignment.UserID == nil || *assignment.UserID != "member" {
				t.Fatalf("expected legacy claim to survive, got %#v", assignment)
			}
			continue
		}
		if assignment.ID != DeterministicAssignmentID(assignment.Date, assignment.ChoreID) {
			t.Fatalf("expected deterministic id for %s/%s, got %s", assignment.Date, assignment.ChoreID, assignment.ID)
		}
	}
	if !sawLegacy {
		t.Fatalf("expected legacy assignment id %q to remain", legacyID)
	}
}

func TestEnsureAssignmentsDetectsDuplicateSlots(t *testing.T) {
	ctx, service, client := newEmulatorService(t)
	setupApartmentFixture(t, ctx, client, "apt-1", []string{"owner", "member"})
	seedAssignment(t, ctx, client, "apt-1", "assignment-1", map[string]any{
		"apartmentId": "apt-1",
		"choreId":     "chore-1",
		"date":        "2026-01-05",
		"weekNumber":  202602,
	})
	seedAssignment(t, ctx, client, "apt-1", "assignment-2", map[string]any{
		"apartmentId": "apt-1",
		"choreId":     "chore-1",
		"date":        "2026-01-05",
		"weekNumber":  202602,
	})

	_, err := service.EnsureAssignmentsForWeek(ctx, "owner", "apt-1", 202602)
	if err == nil {
		t.Fatal("expected duplicate slot error")
	}
	if !hasDomainCode(err, "duplicate_assignment_slot") {
		t.Fatalf("expected duplicate_assignment_slot, got %v", err)
	}
}

func TestLegacyRecordsGetSafeDefaults(t *testing.T) {
	ctx, service, client := newEmulatorService(t)
	seedUser(t, ctx, client, "legacy-user", map[string]any{"name": "Legacy", "apartmentId": "apt-1"})
	seedApartment(t, ctx, client, "apt-1", map[string]any{"name": "Legacy Apt", "inviteCode": "LEGACY", "createdBy": "legacy-user"})
	seedChore(t, ctx, client, "apt-1", "chore-1", map[string]any{"name": "Dinner"})
	seedAssignment(t, ctx, client, "apt-1", "assignment-1", map[string]any{
		"apartmentId": "apt-1",
		"choreId":     "chore-1",
		"date":        "2026-01-05",
		"weekNumber":  202602,
	})

	profile := mustGetProfile(t, ctx, service, "legacy-user")
	if profile.NotifyDaily || profile.NotifyWeekly {
		t.Fatalf("expected missing notification flags to default false, got %#v", profile)
	}
	apartment, err := service.GetApartment(ctx, "legacy-user", "apt-1")
	if err != nil {
		t.Fatalf("GetApartment() error = %v", err)
	}
	if apartment.Timezone != "UTC" {
		t.Fatalf("expected missing timezone to default UTC, got %q", apartment.Timezone)
	}
	assignments, err := service.GetAssignmentsForWeek(ctx, "legacy-user", "apt-1", 202602)
	if err != nil {
		t.Fatalf("GetAssignmentsForWeek() error = %v", err)
	}
	if got, want := len(assignments), 1; got != want {
		t.Fatalf("expected %d assignment, got %d", want, got)
	}
	if assignments[0].UserID != nil || assignments[0].ManuallyAssigned {
		t.Fatalf("expected safe defaults for legacy assignment, got %#v", assignments[0])
	}
}

func newEmulatorService(t *testing.T) (context.Context, *Service, *firestore.Client) {
	t.Helper()
	if os.Getenv("FIRESTORE_EMULATOR_HOST") == "" {
		t.Skip("FIRESTORE_EMULATOR_HOST is not set")
	}
	ctx := context.Background()
	projectID := fmt.Sprintf("demo-choreezo-%d", time.Now().UnixNano())
	client, err := firestore.NewClient(ctx, projectID)
	if err != nil {
		t.Fatalf("firestore.NewClient() error = %v", err)
	}
	t.Cleanup(func() { _ = client.Close() })
	service := NewService(client, nil)
	service.now = func() time.Time {
		return time.Date(2026, time.January, 5, 12, 0, 0, 0, time.UTC)
	}
	return ctx, service, client
}

func setupApartmentFixture(t *testing.T, ctx context.Context, client *firestore.Client, apartmentID string, memberIDs []string) {
	t.Helper()
	seedApartment(t, ctx, client, apartmentID, map[string]any{
		"name":       "Apt",
		"inviteCode": "FIX123",
		"timezone":   "UTC",
		"createdBy":  memberIDs[0],
	})
	seedInviteMapping(t, ctx, client, "FIX123", apartmentID)
	for _, memberID := range memberIDs {
		seedUser(t, ctx, client, memberID, map[string]any{"name": memberID, "apartmentId": apartmentID})
	}
	seedChore(t, ctx, client, apartmentID, "chore-1", map[string]any{"name": "Dinner"})
	seedChore(t, ctx, client, apartmentID, "chore-2", map[string]any{"name": "Lunch"})
}

func seedUser(t *testing.T, ctx context.Context, client *firestore.Client, uid string, data map[string]any) {
	t.Helper()
	seedDoc(t, ctx, client.Collection(usersCollection).Doc(uid), data)
}

func seedApartment(t *testing.T, ctx context.Context, client *firestore.Client, apartmentID string, data map[string]any) *Apartment {
	t.Helper()
	seedDoc(t, ctx, client.Collection(apartmentsCollection).Doc(apartmentID), data)
	apartment, err := apartmentFromSnapshot(mustGetDoc(t, ctx, client.Collection(apartmentsCollection).Doc(apartmentID)))
	if err != nil {
		t.Fatalf("apartmentFromSnapshot() error = %v", err)
	}
	return apartment
}

func seedInviteMapping(t *testing.T, ctx context.Context, client *firestore.Client, inviteCode string, apartmentID string) {
	t.Helper()
	seedDoc(t, ctx, client.Collection(inviteMappingsCollection).Doc(inviteCode), map[string]any{"inviteCode": inviteCode, "apartmentId": apartmentID})
}

func seedChore(t *testing.T, ctx context.Context, client *firestore.Client, apartmentID string, choreID string, data map[string]any) {
	t.Helper()
	seedDoc(t, ctx, client.Collection(apartmentsCollection).Doc(apartmentID).Collection(choresCollection).Doc(choreID), data)
}

func seedAssignment(t *testing.T, ctx context.Context, client *firestore.Client, apartmentID string, assignmentID string, data map[string]any) {
	t.Helper()
	seedDoc(t, ctx, client.Collection(apartmentsCollection).Doc(apartmentID).Collection(assignmentsCollection).Doc(assignmentID), data)
}

func seedDevice(t *testing.T, ctx context.Context, client *firestore.Client, uid string, deviceID string, data map[string]any) {
	t.Helper()
	seedDoc(t, ctx, client.Collection(usersCollection).Doc(uid).Collection(deviceRegistrationsCollection).Doc(deviceID), data)
}

func seedDoc(t *testing.T, ctx context.Context, ref *firestore.DocumentRef, data map[string]any) {
	t.Helper()
	withMetadata := map[string]any{}
	for key, value := range data {
		withMetadata[key] = value
	}
	if _, ok := withMetadata["id"]; !ok {
		withMetadata["id"] = ref.ID
	}
	if _, ok := withMetadata["createdAt"]; !ok {
		withMetadata["createdAt"] = time.Date(2026, time.January, 5, 12, 0, 0, 0, time.UTC)
	}
	if _, ok := withMetadata["updatedAt"]; !ok {
		withMetadata["updatedAt"] = time.Date(2026, time.January, 5, 12, 0, 0, 0, time.UTC)
	}
	if _, err := ref.Set(ctx, withMetadata); err != nil {
		t.Fatalf("Set(%s) error = %v", ref.Path, err)
	}
}

func mustGetDoc(t *testing.T, ctx context.Context, ref *firestore.DocumentRef) *firestore.DocumentSnapshot {
	t.Helper()
	snap, err := ref.Get(ctx)
	if err != nil {
		t.Fatalf("Get(%s) error = %v", ref.Path, err)
	}
	return snap
}

func mustGetProfile(t *testing.T, ctx context.Context, service *Service, uid string) *Profile {
	t.Helper()
	profile, err := service.GetProfile(ctx, uid)
	if err != nil {
		t.Fatalf("GetProfile(%s) error = %v", uid, err)
	}
	return profile
}

func listChoresRaw(t *testing.T, ctx context.Context, client *firestore.Client, apartmentID string) []string {
	t.Helper()
	iter := client.Collection(apartmentsCollection).Doc(apartmentID).Collection(choresCollection).Documents(ctx)
	defer iter.Stop()
	var ids []string
	for {
		snap, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			t.Fatalf("list chores error = %v", err)
		}
		ids = append(ids, snap.Ref.ID)
	}
	sort.Strings(ids)
	return ids
}

func listAssignmentsRaw(t *testing.T, ctx context.Context, client *firestore.Client, apartmentID string) []string {
	t.Helper()
	iter := client.Collection(apartmentsCollection).Doc(apartmentID).Collection(assignmentsCollection).Documents(ctx)
	defer iter.Stop()
	var ids []string
	for {
		snap, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			t.Fatalf("list assignments error = %v", err)
		}
		ids = append(ids, snap.Ref.ID)
	}
	sort.Strings(ids)
	return ids
}

func assertDocumentMissing(t *testing.T, ctx context.Context, ref *firestore.DocumentRef) {
	t.Helper()
	_, err := ref.Get(ctx)
	if grpcstatus.Code(err) != codes.NotFound {
		t.Fatalf("expected %s to be missing, got %v", ref.Path, err)
	}
}

func hasDomainCode(err error, code string) bool {
	var domainErr *Error
	return errors.As(err, &domainErr) && domainErr.Code == code
}
