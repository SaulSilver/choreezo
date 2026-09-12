package domain

import (
	"context"
	crand "crypto/rand"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"
)

const (
	usersCollection               = "users"
	apartmentsCollection          = "apartments"
	inviteMappingsCollection      = "apartmentInviteCodes"
	inviteAttemptsCollection      = "inviteJoinAttempts"
	choresCollection              = "chores"
	assignmentsCollection         = "assignments"
	deviceRegistrationsCollection = "devices"
	inviteCodeLength              = 6
	inviteCreateRetries           = 20
	inviteRateLimit               = 10
	deleteBatchSize               = 200
)

var (
	errInviteCollision = errors.New("invite code collision")
	inviteCodeAlphabet = []byte("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
	defaultChores      = []struct {
		Name string
		Icon string
	}{
		{Name: "Lunch", Icon: "🍽️"},
		{Name: "Dinner", Icon: "🍴"},
		{Name: "Hoover", Icon: "🧹"},
		{Name: "Mop", Icon: "🪣"},
		{Name: "Dusting", Icon: "🧹"},
		{Name: "Kitchen Cleaning", Icon: "🧽"},
	}
	demoMemberNames = []string{"Sam", "Riley", "Taylor"}
)

type Service struct {
	client              *firestore.Client
	logger              *slog.Logger
	now                 func() time.Time
	inviteCodeGenerator func() string
	inviteRateWindow    time.Duration
}

func NewService(client *firestore.Client, logger *slog.Logger) *Service {
	if logger == nil {
		logger = slog.New(slog.NewTextHandler(io.Discard, nil))
	}
	return &Service{
		client:              client,
		logger:              logger,
		now:                 time.Now,
		inviteCodeGenerator: generateInviteCode,
		inviteRateWindow:    5 * time.Minute,
	}
}

func (s *Service) GetProfile(ctx context.Context, uid string) (*Profile, error) {
	user, err := s.getUser(ctx, uid)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (s *Service) UpdateProfile(ctx context.Context, uid string, input UpdateProfileInput) (*Profile, error) {
	if s == nil || s.client == nil {
		return nil, NewError(http.StatusServiceUnavailable, "service_unavailable", "profile service is not configured")
	}

	updates, err := buildProfileUpdateMap(input)
	if err != nil {
		return nil, err
	}

	userRef := s.client.Collection(usersCollection).Doc(uid)
	if err := s.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		_, exists, err := readUserRecordTx(tx, userRef)
		if err != nil {
			return err
		}
		if exists {
			mergeMetadata(updates, false)
		} else {
			mergeMetadata(updates, true)
		}
		return tx.Set(userRef, updates, firestore.MergeAll)
	}); err != nil {
		return nil, translateError(err)
	}

	return s.getUser(ctx, uid)
}

func (s *Service) DeleteProfile(ctx context.Context, uid string) error {
	if s == nil || s.client == nil {
		return NewError(http.StatusServiceUnavailable, "service_unavailable", "profile service is not configured")
	}

	ownerIter := s.client.Collection(apartmentsCollection).Where("createdBy", "==", uid).Limit(1).Documents(ctx)
	defer ownerIter.Stop()
	if _, err := ownerIter.Next(); err == nil {
		return NewError(http.StatusConflict, "apartment_owner_conflict", "delete the owned apartment before deleting the profile")
	} else if !errors.Is(err, iterator.Done) {
		return translateError(err)
	}

	userRef := s.client.Collection(usersCollection).Doc(uid)
	if err := s.deleteCollection(ctx, userRef.Collection(deviceRegistrationsCollection), deleteBatchSize); err != nil {
		return err
	}
	if _, err := userRef.Delete(ctx); err != nil {
		return translateError(err)
	}
	return nil
}

func (s *Service) RegisterDevice(ctx context.Context, uid string, input RegisterDeviceInput) error {
	if s == nil || s.client == nil {
		return NewError(http.StatusServiceUnavailable, "service_unavailable", "device service is not configured")
	}

	deviceID := strings.TrimSpace(input.DeviceID)
	if deviceID == "" {
		return NewError(http.StatusBadRequest, "invalid_device", "deviceId is required")
	}
	token := strings.TrimSpace(input.ExpoPushToken)
	if token == "" {
		return NewError(http.StatusBadRequest, "invalid_device", "expoPushToken is required")
	}

	platform := normalizeOptionalString(input.Platform)
	userRef := s.client.Collection(usersCollection).Doc(uid)
	deviceRef := userRef.Collection(deviceRegistrationsCollection).Doc(deviceID)
	if err := s.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		_, userExists, err := readUserRecordTx(tx, userRef)
		if err != nil {
			return err
		}
		_, deviceExists, err := readDeviceRecordTx(tx, deviceRef)
		if err != nil {
			return err
		}

		deviceData := map[string]any{
			"deviceId":      deviceID,
			"expoPushToken": token,
			"enabled":       true,
		}
		if platform != nil {
			deviceData["platform"] = *platform
		}
		mergeMetadata(deviceData, !deviceExists)
		if err := tx.Set(deviceRef, deviceData, firestore.MergeAll); err != nil {
			return err
		}

		userData := map[string]any{"expoPushToken": token}
		mergeMetadata(userData, !userExists)
		return tx.Set(userRef, userData, firestore.MergeAll)
	}); err != nil {
		return translateError(err)
	}

	return nil
}

func (s *Service) UnregisterDevice(ctx context.Context, uid string, deviceID string) error {
	if s == nil || s.client == nil {
		return NewError(http.StatusServiceUnavailable, "service_unavailable", "device service is not configured")
	}

	deviceID = strings.TrimSpace(deviceID)
	if deviceID == "" {
		return NewError(http.StatusBadRequest, "invalid_device", "deviceId is required")
	}

	userRef := s.client.Collection(usersCollection).Doc(uid)
	deviceRef := userRef.Collection(deviceRegistrationsCollection).Doc(deviceID)
	if _, err := deviceRef.Delete(ctx); err != nil {
		return translateError(err)
	}

	remainingToken, err := s.firstRegisteredDeviceToken(ctx, uid)
	if err != nil {
		return err
	}

	userSnap, err := userRef.Get(ctx)
	if err != nil {
		if grpcstatus.Code(err) == codes.NotFound {
			return nil
		}
		return translateError(err)
	}

	batch := s.client.Batch()
	if remainingToken == nil {
		batch.Update(userRef, []firestore.Update{
			{Path: "expoPushToken", Value: firestore.Delete},
			{Path: "updatedAt", Value: firestore.ServerTimestamp},
		})
	} else {
		updates := map[string]any{"expoPushToken": *remainingToken}
		mergeMetadata(updates, !userSnap.Exists())
		batch.Set(userRef, updates, firestore.MergeAll)
	}
	_, err = batch.Commit(ctx)
	return translateError(err)
}

func (s *Service) CreateApartment(ctx context.Context, uid string, input CreateApartmentInput) (*Apartment, error) {
	return s.createApartment(ctx, uid, input, false)
}

func (s *Service) CreateDemoApartment(ctx context.Context, uid string) (*Apartment, error) {
	return s.createApartment(ctx, uid, CreateApartmentInput{Name: "Demo Apartment", Timezone: "UTC"}, true)
}

func (s *Service) JoinApartment(ctx context.Context, uid string, input JoinApartmentInput) (*Apartment, error) {
	if s == nil || s.client == nil {
		return nil, NewError(http.StatusServiceUnavailable, "service_unavailable", "apartment service is not configured")
	}

	inviteCode := strings.ToUpper(strings.TrimSpace(input.InviteCode))
	if inviteCode == "" {
		return nil, NewError(http.StatusBadRequest, "invalid_invite_code", "inviteCode is required")
	}

	var apartmentID string
	userRef := s.client.Collection(usersCollection).Doc(uid)
	attemptRef := s.client.Collection(inviteAttemptsCollection).Doc(uid)
	mappingRef := s.client.Collection(inviteMappingsCollection).Doc(inviteCode)

	if err := s.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		if err := s.recordInviteAttemptTx(tx, attemptRef); err != nil {
			return err
		}

		user, _, err := readUserRecordTx(tx, userRef)
		if err != nil {
			return err
		}

		mappingSnap, err := tx.Get(mappingRef)
		if grpcstatus.Code(err) == codes.NotFound {
			return NewError(http.StatusNotFound, "invalid_invite_code", "invalid invite code")
		}
		if err != nil {
			return err
		}

		mapping := struct {
			ApartmentID string `firestore:"apartmentId"`
		}{}
		if err := mappingSnap.DataTo(&mapping); err != nil {
			return err
		}
		if strings.TrimSpace(mapping.ApartmentID) == "" {
			return NewError(http.StatusNotFound, "invalid_invite_code", "invalid invite code")
		}

		apartmentRef := s.client.Collection(apartmentsCollection).Doc(mapping.ApartmentID)
		apartmentSnap, err := tx.Get(apartmentRef)
		if grpcstatus.Code(err) == codes.NotFound {
			return NewError(http.StatusNotFound, "invalid_invite_code", "invalid invite code")
		}
		if err != nil {
			return err
		}
		apartment, err := apartmentFromSnapshot(apartmentSnap)
		if err != nil {
			return err
		}

		if user.ApartmentID != nil {
			if *user.ApartmentID == apartment.ID {
				apartmentID = apartment.ID
				return nil
			}
			return NewError(http.StatusConflict, "apartment_membership_exists", "leave the current apartment before joining a new apartment")
		}

		update := map[string]any{"apartmentId": apartment.ID}
		mergeMetadata(update, false)
		if err := tx.Set(userRef, update, firestore.MergeAll); err != nil {
			return err
		}
		apartmentID = apartment.ID
		return nil
	}); err != nil {
		return nil, translateError(err)
	}

	return s.getApartmentByID(ctx, apartmentID)
}

func (s *Service) GetApartment(ctx context.Context, uid string, apartmentID string) (*Apartment, error) {
	apartmentID = strings.TrimSpace(apartmentID)
	if apartmentID == "" {
		return nil, NewError(http.StatusBadRequest, "invalid_apartment", "apartmentId is required")
	}
	if _, _, err := s.requireMembership(ctx, uid, apartmentID); err != nil {
		return nil, err
	}
	return s.getApartmentByID(ctx, apartmentID)
}

func (s *Service) GetApartmentMembers(ctx context.Context, uid string, apartmentID string) ([]Member, error) {
	apartmentID = strings.TrimSpace(apartmentID)
	if apartmentID == "" {
		return nil, NewError(http.StatusBadRequest, "invalid_apartment", "apartmentId is required")
	}
	if _, _, err := s.requireMembership(ctx, uid, apartmentID); err != nil {
		return nil, err
	}

	iter := s.client.Collection(usersCollection).Where("apartmentId", "==", apartmentID).Documents(ctx)
	defer iter.Stop()

	members := make([]Member, 0)
	for {
		snap, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, translateError(err)
		}

		user, err := profileFromSnapshot(snap)
		if err != nil {
			return nil, translateError(err)
		}
		members = append(members, Member{ID: user.ID, Name: user.Name, IsDemoUser: user.IsDemoUser})
	}

	sort.Slice(members, func(i, j int) bool {
		if members[i].Name == members[j].Name {
			return members[i].ID < members[j].ID
		}
		return members[i].Name < members[j].Name
	})
	return members, nil
}

func (s *Service) LeaveApartment(ctx context.Context, uid string, apartmentID string) error {
	apartmentID = strings.TrimSpace(apartmentID)
	if apartmentID == "" {
		return NewError(http.StatusBadRequest, "invalid_apartment", "apartmentId is required")
	}

	apartment, _, err := s.requireMembership(ctx, uid, apartmentID)
	if err != nil {
		return err
	}
	if apartment.CreatedBy == uid {
		return NewError(http.StatusConflict, "apartment_owner_conflict", "delete the apartment before leaving it")
	}

	userRef := s.client.Collection(usersCollection).Doc(uid)
	_, err = userRef.Set(ctx, map[string]any{
		"apartmentId": nil,
		"updatedAt":   firestore.ServerTimestamp,
	}, firestore.MergeAll)
	return translateError(err)
}

func (s *Service) DeleteApartment(ctx context.Context, uid string, apartmentID string) error {
	apartment, _, err := s.requireMembership(ctx, uid, apartmentID)
	if err != nil {
		return err
	}
	if apartment.CreatedBy != uid {
		return NewError(http.StatusForbidden, "forbidden", "only the apartment owner can delete the apartment")
	}
	if apartment.IsDemo {
		return NewError(http.StatusConflict, "demo_clear_required", "use the demo clear flow for demo apartments")
	}
	return s.destroyApartment(ctx, apartment, false)
}

func (s *Service) ClearDemoApartment(ctx context.Context, uid string, apartmentID string) error {
	apartment, _, err := s.requireMembership(ctx, uid, apartmentID)
	if err != nil {
		return err
	}
	if !apartment.IsDemo {
		return NewError(http.StatusConflict, "not_demo_apartment", "only demo apartments can be cleared with this flow")
	}
	if apartment.CreatedBy != uid {
		return NewError(http.StatusForbidden, "forbidden", "only the demo owner can clear this apartment")
	}
	return s.destroyApartment(ctx, apartment, true)
}

func (s *Service) ListChores(ctx context.Context, uid string, apartmentID string) ([]Chore, error) {
	if _, _, err := s.requireMembership(ctx, uid, apartmentID); err != nil {
		return nil, err
	}
	iter := s.client.Collection(apartmentsCollection).Doc(apartmentID).Collection(choresCollection).Documents(ctx)
	defer iter.Stop()

	chores := make([]Chore, 0)
	for {
		snap, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, translateError(err)
		}
		chore, err := choreFromSnapshot(snap)
		if err != nil {
			return nil, translateError(err)
		}
		chores = append(chores, *chore)
	}
	sort.Slice(chores, func(i, j int) bool {
		if chores[i].Name == chores[j].Name {
			return chores[i].ID < chores[j].ID
		}
		return chores[i].Name < chores[j].Name
	})
	return chores, nil
}

func (s *Service) GetAssignmentsForWeek(ctx context.Context, uid string, apartmentID string, weekNumber int) ([]Assignment, error) {
	if _, _, err := s.requireMembership(ctx, uid, apartmentID); err != nil {
		return nil, err
	}
	if _, err := WeekDates(weekNumber); err != nil {
		return nil, NewError(http.StatusBadRequest, "invalid_week_number", err.Error())
	}
	return s.getAssignmentsForWeekByApartment(ctx, apartmentID, weekNumber)
}

func (s *Service) EnsureAssignmentsForWeek(ctx context.Context, uid string, apartmentID string, weekNumber int) ([]Assignment, error) {
	if _, err := WeekDates(weekNumber); err != nil {
		return nil, NewError(http.StatusBadRequest, "invalid_week_number", err.Error())
	}

	apartmentRef := s.client.Collection(apartmentsCollection).Doc(apartmentID)
	userRef := s.client.Collection(usersCollection).Doc(uid)
	if err := s.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		user, _, err := readUserRecordTx(tx, userRef)
		if err != nil {
			return err
		}
		if user.ApartmentID == nil || *user.ApartmentID != apartmentID {
			return NewError(http.StatusNotFound, "not_found", "resource not found")
		}
		if _, err := tx.Get(apartmentRef); err != nil {
			return err
		}

		chores, err := readChoresTx(tx, apartmentRef.Collection(choresCollection))
		if err != nil {
			return err
		}
		if len(chores) == 0 {
			return nil
		}

		existing, err := readAssignmentsForWeekTx(tx, apartmentRef.Collection(assignmentsCollection), weekNumber)
		if err != nil {
			return err
		}
		existingByKey := make(map[string]Assignment, len(existing))
		for _, assignment := range existing {
			key := assignment.Date + "-" + assignment.ChoreID
			if _, ok := existingByKey[key]; ok {
				return NewError(http.StatusConflict, "duplicate_assignment_slot", "duplicate assignment slots already exist for this week")
			}
			existingByKey[key] = assignment
		}

		weekDates, err := WeekDates(weekNumber)
		if err != nil {
			return err
		}
		for _, date := range weekDates {
			dateStr := FormatDate(date)
			for _, chore := range chores {
				key := dateStr + "-" + chore.ID
				if _, ok := existingByKey[key]; ok {
					continue
				}
				assignmentID := DeterministicAssignmentID(dateStr, chore.ID)
				assignmentRef := apartmentRef.Collection(assignmentsCollection).Doc(assignmentID)
				snap, err := tx.Get(assignmentRef)
				if err != nil && grpcstatus.Code(err) != codes.NotFound {
					return err
				}
				if err == nil && snap.Exists() {
					assignment, decodeErr := assignmentFromSnapshot(snap)
					if decodeErr != nil {
						return decodeErr
					}
					existingByKey[key] = *assignment
					continue
				}
				assignment := map[string]any{
					"id":               assignmentID,
					"apartmentId":      apartmentID,
					"userId":           nil,
					"choreId":          chore.ID,
					"date":             dateStr,
					"weekNumber":       weekNumber,
					"manuallyAssigned": false,
				}
				mergeMetadata(assignment, true)
				if err := tx.Create(assignmentRef, assignment); err != nil {
					return err
				}
			}
		}
		return nil
	}); err != nil {
		return nil, translateError(err)
	}

	return s.getAssignmentsForWeekByApartment(ctx, apartmentID, weekNumber)
}

func (s *Service) ClaimAssignment(ctx context.Context, uid string, apartmentID string, assignmentID string) (*Assignment, error) {
	return s.updateClaimState(ctx, uid, apartmentID, assignmentID, true)
}

func (s *Service) UnclaimAssignment(ctx context.Context, uid string, apartmentID string, assignmentID string) (*Assignment, error) {
	return s.updateClaimState(ctx, uid, apartmentID, assignmentID, false)
}

func (s *Service) SetAssignmentUser(ctx context.Context, uid string, apartmentID string, assignmentID string, targetUserID *string) (*Assignment, error) {
	if targetUserID != nil {
		trimmed := strings.TrimSpace(*targetUserID)
		if trimmed == "" {
			targetUserID = nil
		} else {
			targetUserID = &trimmed
		}
	}

	assignmentRef := s.client.Collection(apartmentsCollection).Doc(apartmentID).Collection(assignmentsCollection).Doc(assignmentID)
	userRef := s.client.Collection(usersCollection).Doc(uid)
	if err := s.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		user, _, err := readUserRecordTx(tx, userRef)
		if err != nil {
			return err
		}
		if user.ApartmentID == nil || *user.ApartmentID != apartmentID {
			return NewError(http.StatusNotFound, "not_found", "resource not found")
		}

		if targetUserID != nil {
			targetRef := s.client.Collection(usersCollection).Doc(*targetUserID)
			target, exists, err := readUserRecordTx(tx, targetRef)
			if err != nil {
				return err
			}
			if !exists || target.ApartmentID == nil || *target.ApartmentID != apartmentID {
				return NewError(http.StatusBadRequest, "invalid_assignment_target", "assignment target must be a current apartment member")
			}
		}

		assignmentSnap, err := tx.Get(assignmentRef)
		if grpcstatus.Code(err) == codes.NotFound {
			return NewError(http.StatusNotFound, "not_found", "resource not found")
		}
		if err != nil {
			return err
		}
		assignment, err := assignmentFromSnapshot(assignmentSnap)
		if err != nil {
			return err
		}
		if assignment.UserID == nil && targetUserID == nil && !assignment.ManuallyAssigned {
			return nil
		}
		if assignment.UserID != nil && targetUserID != nil && *assignment.UserID == *targetUserID && assignment.ManuallyAssigned {
			return nil
		}
		return tx.Update(assignmentRef, []firestore.Update{
			{Path: "userId", Value: targetUserID},
			{Path: "manuallyAssigned", Value: targetUserID != nil},
			{Path: "updatedAt", Value: firestore.ServerTimestamp},
		})
	}); err != nil {
		return nil, translateError(err)
	}

	return s.getAssignment(ctx, apartmentID, assignmentID)
}

func (s *Service) createApartment(ctx context.Context, uid string, input CreateApartmentInput, demo bool) (*Apartment, error) {
	if s == nil || s.client == nil {
		return nil, NewError(http.StatusServiceUnavailable, "service_unavailable", "apartment service is not configured")
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, NewError(http.StatusBadRequest, "invalid_apartment", "name is required")
	}
	timezone := strings.TrimSpace(input.Timezone)
	if timezone == "" {
		timezone = "UTC"
	}

	for attempts := 0; attempts < inviteCreateRetries; attempts++ {
		inviteCode := strings.ToUpper(strings.TrimSpace(s.inviteCodeGenerator()))
		if inviteCode == "" {
			continue
		}
		apartmentRef := s.client.Collection(apartmentsCollection).NewDoc()
		userRef := s.client.Collection(usersCollection).Doc(uid)
		mappingRef := s.client.Collection(inviteMappingsCollection).Doc(inviteCode)
		weekLocation := time.UTC
		if loadedLocation, err := time.LoadLocation(timezone); err == nil {
			weekLocation = loadedLocation
		}
		weekNumber := ISOWeekNumberAt(s.now(), weekLocation)
		if err := s.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
			user, userExists, err := readUserRecordTx(tx, userRef)
			if err != nil {
				return err
			}
			if user.ApartmentID != nil {
				return NewError(http.StatusConflict, "apartment_membership_exists", "leave the current apartment before creating a new apartment")
			}

			if existingMapping, err := tx.Get(mappingRef); err == nil && existingMapping.Exists() {
				return errInviteCollision
			} else if err != nil && grpcstatus.Code(err) != codes.NotFound {
				return err
			}

			apartmentData := map[string]any{
				"id":         apartmentRef.ID,
				"name":       name,
				"isDemo":     demo,
				"inviteCode": inviteCode,
				"timezone":   timezone,
				"createdBy":  uid,
			}
			mergeMetadata(apartmentData, true)
			if err := tx.Create(apartmentRef, apartmentData); err != nil {
				return err
			}

			mappingData := map[string]any{
				"inviteCode":  inviteCode,
				"apartmentId": apartmentRef.ID,
			}
			mergeMetadata(mappingData, true)
			if err := tx.Create(mappingRef, mappingData); err != nil {
				return err
			}

			ownerUpdate := map[string]any{"apartmentId": apartmentRef.ID}
			mergeMetadata(ownerUpdate, !userExists)
			if err := tx.Set(userRef, ownerUpdate, firestore.MergeAll); err != nil {
				return err
			}

			createdChores := make([]Chore, 0, len(defaultChores))
			for _, chore := range defaultChores {
				icon := chore.Icon
				choreRef := apartmentRef.Collection(choresCollection).NewDoc()
				choreData := map[string]any{
					"id":   choreRef.ID,
					"name": chore.Name,
					"icon": icon,
				}
				mergeMetadata(choreData, true)
				if err := tx.Create(choreRef, choreData); err != nil {
					return err
				}
				createdChores = append(createdChores, Chore{ID: choreRef.ID, Name: chore.Name, Icon: &icon})
			}

			if !demo {
				return nil
			}

			memberIDs := []string{uid}
			for index, memberName := range demoMemberNames {
				memberID := fmt.Sprintf("%s-demo-%d", apartmentRef.ID, index+1)
				memberIDs = append(memberIDs, memberID)
				memberData := map[string]any{
					"id":           memberID,
					"name":         memberName,
					"apartmentId":  apartmentRef.ID,
					"isDemoUser":   true,
					"notifyDaily":  false,
					"notifyWeekly": false,
				}
				mergeMetadata(memberData, true)
				if err := tx.Set(s.client.Collection(usersCollection).Doc(memberID), memberData, firestore.MergeAll); err != nil {
					return err
				}
			}

			weekDates, err := WeekDates(weekNumber)
			if err != nil {
				return err
			}
			for dayIndex, date := range weekDates {
				dateStr := FormatDate(date)
				for choreIndex, chore := range createdChores {
					memberID := memberIDs[(dayIndex+choreIndex)%len(memberIDs)]
					assignmentRef := apartmentRef.Collection(assignmentsCollection).NewDoc()
					assignmentData := map[string]any{
						"id":               assignmentRef.ID,
						"apartmentId":      apartmentRef.ID,
						"userId":           memberID,
						"choreId":          chore.ID,
						"date":             dateStr,
						"weekNumber":       weekNumber,
						"manuallyAssigned": true,
					}
					mergeMetadata(assignmentData, true)
					if err := tx.Create(assignmentRef, assignmentData); err != nil {
						return err
					}
				}
			}

			return nil
		}); err != nil {
			if errors.Is(err, errInviteCollision) {
				continue
			}
			if grpcstatus.Code(err) == codes.AlreadyExists {
				continue
			}
			return nil, translateError(err)
		}
		return s.getApartmentByID(ctx, apartmentRef.ID)
	}

	return nil, NewError(http.StatusConflict, "invite_code_exhausted", "failed to reserve a unique invite code")
}

func (s *Service) destroyApartment(ctx context.Context, apartment *Apartment, deleteDemoUsers bool) error {
	if apartment == nil {
		return NewError(http.StatusNotFound, "not_found", "resource not found")
	}

	apartmentRef := s.client.Collection(apartmentsCollection).Doc(apartment.ID)
	if err := s.deleteCollection(ctx, apartmentRef.Collection(assignmentsCollection), deleteBatchSize); err != nil {
		return err
	}
	if err := s.deleteCollection(ctx, apartmentRef.Collection(choresCollection), deleteBatchSize); err != nil {
		return err
	}

	membersIter := s.client.Collection(usersCollection).Where("apartmentId", "==", apartment.ID).Documents(ctx)
	defer membersIter.Stop()
	batch := s.client.Batch()
	operations := 0
	flush := func() error {
		if operations == 0 {
			return nil
		}
		if _, err := batch.Commit(ctx); err != nil {
			return translateError(err)
		}
		batch = s.client.Batch()
		operations = 0
		return nil
	}

	for {
		snap, err := membersIter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return translateError(err)
		}
		user, decodeErr := profileFromSnapshot(snap)
		if decodeErr != nil {
			return translateError(decodeErr)
		}
		if deleteDemoUsers && user.IsDemoUser {
			if err := s.deleteCollection(ctx, snap.Ref.Collection(deviceRegistrationsCollection), deleteBatchSize); err != nil {
				return err
			}
			batch.Delete(snap.Ref)
		} else {
			batch.Set(snap.Ref, map[string]any{
				"apartmentId": nil,
				"updatedAt":   firestore.ServerTimestamp,
			}, firestore.MergeAll)
		}
		operations++
		if operations >= deleteBatchSize {
			if err := flush(); err != nil {
				return err
			}
		}
	}
	if err := flush(); err != nil {
		return err
	}

	if apartment.InviteCode != "" {
		if _, err := s.client.Collection(inviteMappingsCollection).Doc(apartment.InviteCode).Delete(ctx); err != nil {
			return translateError(err)
		}
	}
	if _, err := apartmentRef.Delete(ctx); err != nil {
		return translateError(err)
	}
	return nil
}

func (s *Service) updateClaimState(ctx context.Context, uid string, apartmentID string, assignmentID string, claim bool) (*Assignment, error) {
	assignmentRef := s.client.Collection(apartmentsCollection).Doc(apartmentID).Collection(assignmentsCollection).Doc(assignmentID)
	userRef := s.client.Collection(usersCollection).Doc(uid)
	if err := s.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		user, _, err := readUserRecordTx(tx, userRef)
		if err != nil {
			return err
		}
		if user.ApartmentID == nil || *user.ApartmentID != apartmentID {
			return NewError(http.StatusNotFound, "not_found", "resource not found")
		}

		snap, err := tx.Get(assignmentRef)
		if grpcstatus.Code(err) == codes.NotFound {
			return NewError(http.StatusNotFound, "not_found", "resource not found")
		}
		if err != nil {
			return err
		}
		assignment, err := assignmentFromSnapshot(snap)
		if err != nil {
			return err
		}

		if claim {
			if assignment.UserID != nil {
				if *assignment.UserID == uid {
					return nil
				}
				return NewError(http.StatusConflict, "assignment_already_claimed", "assignment is already claimed")
			}
			return tx.Update(assignmentRef, []firestore.Update{
				{Path: "userId", Value: uid},
				{Path: "manuallyAssigned", Value: true},
				{Path: "updatedAt", Value: firestore.ServerTimestamp},
			})
		}

		if assignment.UserID == nil {
			return nil
		}
		if *assignment.UserID != uid {
			return NewError(http.StatusConflict, "assignment_not_claimed_by_user", "assignment is not claimed by the authenticated user")
		}
		return tx.Update(assignmentRef, []firestore.Update{
			{Path: "userId", Value: nil},
			{Path: "manuallyAssigned", Value: false},
			{Path: "updatedAt", Value: firestore.ServerTimestamp},
		})
	}); err != nil {
		return nil, translateError(err)
	}

	return s.getAssignment(ctx, apartmentID, assignmentID)
}

func (s *Service) getApartmentByID(ctx context.Context, apartmentID string) (*Apartment, error) {
	snap, err := s.client.Collection(apartmentsCollection).Doc(apartmentID).Get(ctx)
	if err != nil {
		return nil, translateError(err)
	}
	return apartmentFromSnapshot(snap)
}

func (s *Service) getUser(ctx context.Context, uid string) (*Profile, error) {
	snap, err := s.client.Collection(usersCollection).Doc(uid).Get(ctx)
	if err != nil {
		return nil, translateError(err)
	}
	return profileFromSnapshot(snap)
}

func (s *Service) getAssignment(ctx context.Context, apartmentID string, assignmentID string) (*Assignment, error) {
	snap, err := s.client.Collection(apartmentsCollection).Doc(apartmentID).Collection(assignmentsCollection).Doc(assignmentID).Get(ctx)
	if err != nil {
		return nil, translateError(err)
	}
	return assignmentFromSnapshot(snap)
}

func (s *Service) getAssignmentsForWeekByApartment(ctx context.Context, apartmentID string, weekNumber int) ([]Assignment, error) {
	iter := s.client.Collection(apartmentsCollection).Doc(apartmentID).Collection(assignmentsCollection).Where("weekNumber", "==", weekNumber).Documents(ctx)
	defer iter.Stop()

	assignments := make([]Assignment, 0)
	for {
		snap, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, translateError(err)
		}
		assignment, err := assignmentFromSnapshot(snap)
		if err != nil {
			return nil, translateError(err)
		}
		assignments = append(assignments, *assignment)
	}
	sortAssignments(assignments)
	return assignments, nil
}

func (s *Service) requireMembership(ctx context.Context, uid string, apartmentID string) (*Apartment, *Profile, error) {
	user, err := s.getUser(ctx, uid)
	if err != nil {
		if domainErr, ok := err.(*Error); ok && domainErr.Status == http.StatusNotFound {
			return nil, nil, NewError(http.StatusNotFound, "not_found", "resource not found")
		}
		return nil, nil, err
	}
	if user.ApartmentID == nil || *user.ApartmentID != apartmentID {
		return nil, nil, NewError(http.StatusNotFound, "not_found", "resource not found")
	}
	apartment, err := s.getApartmentByID(ctx, apartmentID)
	if err != nil {
		if domainErr, ok := err.(*Error); ok && domainErr.Status == http.StatusNotFound {
			return nil, nil, NewError(http.StatusNotFound, "not_found", "resource not found")
		}
		return nil, nil, err
	}
	return apartment, user, nil
}

func (s *Service) deleteCollection(ctx context.Context, collection *firestore.CollectionRef, batchSize int) error {
	for {
		iter := collection.Limit(batchSize).Documents(ctx)
		refs := make([]*firestore.DocumentRef, 0, batchSize)
		for {
			snap, err := iter.Next()
			if errors.Is(err, iterator.Done) {
				break
			}
			if err != nil {
				iter.Stop()
				return translateError(err)
			}
			refs = append(refs, snap.Ref)
		}
		iter.Stop()
		if len(refs) == 0 {
			return nil
		}
		batch := s.client.Batch()
		for _, ref := range refs {
			batch.Delete(ref)
		}
		if _, err := batch.Commit(ctx); err != nil {
			return translateError(err)
		}
		if len(refs) < batchSize {
			return nil
		}
	}
}

func (s *Service) firstRegisteredDeviceToken(ctx context.Context, uid string) (*string, error) {
	iter := s.client.Collection(usersCollection).Doc(uid).Collection(deviceRegistrationsCollection).Documents(ctx)
	defer iter.Stop()
	for {
		snap, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			return nil, nil
		}
		if err != nil {
			return nil, translateError(err)
		}
		record := struct {
			ExpoPushToken *string `firestore:"expoPushToken"`
			Enabled       bool    `firestore:"enabled"`
		}{}
		if err := snap.DataTo(&record); err != nil {
			return nil, translateError(err)
		}
		if record.Enabled && record.ExpoPushToken != nil && strings.TrimSpace(*record.ExpoPushToken) != "" {
			token := strings.TrimSpace(*record.ExpoPushToken)
			return &token, nil
		}
	}
}

func (s *Service) recordInviteAttemptTx(tx *firestore.Transaction, attemptRef *firestore.DocumentRef) error {
	now := s.now().UTC()
	record := struct {
		Count         int        `firestore:"count"`
		WindowStarted *time.Time `firestore:"windowStartedAt"`
	}{}
	exists := false
	snap, err := tx.Get(attemptRef)
	if err == nil {
		exists = snap.Exists()
		if exists {
			if err := snap.DataTo(&record); err != nil {
				return err
			}
		}
	} else if grpcstatus.Code(err) != codes.NotFound {
		return err
	}

	windowStarted := now
	count := 1
	if record.WindowStarted != nil && now.Sub(*record.WindowStarted) < s.inviteRateWindow {
		windowStarted = *record.WindowStarted
		count = record.Count + 1
		if count > inviteRateLimit {
			return NewError(http.StatusTooManyRequests, "invite_rate_limited", "too many invite attempts, please try again later")
		}
	}

	data := map[string]any{
		"count":           count,
		"windowStartedAt": windowStarted,
		"lastAttemptAt":   now,
	}
	mergeMetadata(data, !exists)
	return tx.Set(attemptRef, data, firestore.MergeAll)
}

func readAssignmentsForWeekTx(tx *firestore.Transaction, collection *firestore.CollectionRef, weekNumber int) ([]Assignment, error) {
	iter := tx.Documents(collection.Where("weekNumber", "==", weekNumber))
	defer iter.Stop()
	assignments := make([]Assignment, 0)
	for {
		snap, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, err
		}
		assignment, err := assignmentFromSnapshot(snap)
		if err != nil {
			return nil, err
		}
		assignments = append(assignments, *assignment)
	}
	return assignments, nil
}

func readChoresTx(tx *firestore.Transaction, collection *firestore.CollectionRef) ([]Chore, error) {
	refIter := tx.DocumentRefs(collection)
	refs := make([]*firestore.DocumentRef, 0)
	for {
		ref, err := refIter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, err
		}
		refs = append(refs, ref)
	}
	if len(refs) == 0 {
		return nil, nil
	}
	snaps, err := tx.GetAll(refs)
	if err != nil {
		return nil, err
	}
	chores := make([]Chore, 0, len(snaps))
	for _, snap := range snaps {
		if snap == nil || !snap.Exists() {
			continue
		}
		chore, err := choreFromSnapshot(snap)
		if err != nil {
			return nil, err
		}
		chores = append(chores, *chore)
	}
	sort.Slice(chores, func(i, j int) bool { return chores[i].ID < chores[j].ID })
	return chores, nil
}

func readUserRecordTx(tx *firestore.Transaction, ref *firestore.DocumentRef) (*userRecord, bool, error) {
	snap, err := tx.Get(ref)
	if grpcstatus.Code(err) == codes.NotFound {
		return &userRecord{}, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	record := &userRecord{}
	if err := snap.DataTo(record); err != nil {
		return nil, false, err
	}
	return record, snap.Exists(), nil
}

func readDeviceRecordTx(tx *firestore.Transaction, ref *firestore.DocumentRef) (map[string]any, bool, error) {
	snap, err := tx.Get(ref)
	if grpcstatus.Code(err) == codes.NotFound {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return snap.Data(), snap.Exists(), nil
}

func profileFromSnapshot(snap *firestore.DocumentSnapshot) (*Profile, error) {
	record := userRecord{}
	if err := snap.DataTo(&record); err != nil {
		return nil, err
	}
	return &Profile{
		ID:           snap.Ref.ID,
		Name:         record.Name,
		Email:        normalizeOptionalString(record.Email),
		AuthProvider: normalizeOptionalString(record.AuthProvider),
		ApartmentID:  normalizeOptionalString(record.ApartmentID),
		IsDemoUser:   record.IsDemoUser,
		NotifyDaily:  record.NotifyDaily,
		NotifyWeekly: record.NotifyWeekly,
	}, nil
}

func apartmentFromSnapshot(snap *firestore.DocumentSnapshot) (*Apartment, error) {
	record := apartmentRecord{}
	if err := snap.DataTo(&record); err != nil {
		return nil, err
	}
	timezone := strings.TrimSpace(record.Timezone)
	if timezone == "" {
		timezone = "UTC"
	}
	return &Apartment{
		ID:         snap.Ref.ID,
		Name:       record.Name,
		IsDemo:     record.IsDemo,
		InviteCode: strings.ToUpper(strings.TrimSpace(record.InviteCode)),
		Timezone:   timezone,
		CreatedBy:  record.CreatedBy,
	}, nil
}

func choreFromSnapshot(snap *firestore.DocumentSnapshot) (*Chore, error) {
	record := choreRecord{}
	if err := snap.DataTo(&record); err != nil {
		return nil, err
	}
	return &Chore{ID: snap.Ref.ID, Name: record.Name, Icon: normalizeOptionalString(record.Icon)}, nil
}

func assignmentFromSnapshot(snap *firestore.DocumentSnapshot) (*Assignment, error) {
	record := assignmentRecord{}
	if err := snap.DataTo(&record); err != nil {
		return nil, err
	}
	return &Assignment{
		ID:               snap.Ref.ID,
		ApartmentID:      record.ApartmentID,
		UserID:           normalizeOptionalString(record.UserID),
		ChoreID:          record.ChoreID,
		Date:             record.Date,
		WeekNumber:       record.WeekNumber,
		ManuallyAssigned: record.ManuallyAssigned,
	}, nil
}

func buildProfileUpdateMap(input UpdateProfileInput) (map[string]any, error) {
	updates := map[string]any{}
	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" {
			return nil, NewError(http.StatusBadRequest, "invalid_profile", "name must not be empty")
		}
		updates["name"] = name
	}
	if input.Email != nil {
		email := strings.TrimSpace(*input.Email)
		if email == "" {
			return nil, NewError(http.StatusBadRequest, "invalid_profile", "email must not be empty")
		}
		updates["email"] = email
	}
	if input.NotifyDaily != nil {
		updates["notifyDaily"] = *input.NotifyDaily
	}
	if input.NotifyWeekly != nil {
		updates["notifyWeekly"] = *input.NotifyWeekly
	}
	if len(updates) == 0 {
		return nil, NewError(http.StatusBadRequest, "invalid_profile", "at least one profile field must be provided")
	}
	return updates, nil
}

func mergeMetadata(values map[string]any, isCreate bool) {
	if isCreate {
		values["createdAt"] = firestore.ServerTimestamp
	}
	values["updatedAt"] = firestore.ServerTimestamp
}

func normalizeOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func sortAssignments(assignments []Assignment) {
	sort.Slice(assignments, func(i, j int) bool {
		if assignments[i].Date != assignments[j].Date {
			return assignments[i].Date < assignments[j].Date
		}
		if assignments[i].ChoreID != assignments[j].ChoreID {
			return assignments[i].ChoreID < assignments[j].ChoreID
		}
		return assignments[i].ID < assignments[j].ID
	})
}

func translateError(err error) error {
	if err == nil {
		return nil
	}
	if domainErr, ok := err.(*Error); ok {
		return domainErr
	}
	switch grpcstatus.Code(err) {
	case codes.NotFound:
		return NewError(http.StatusNotFound, "not_found", "resource not found")
	case codes.AlreadyExists:
		return NewError(http.StatusConflict, "conflict", "resource already exists")
	default:
		return err
	}
}

func generateInviteCode() string {
	bytes := make([]byte, inviteCodeLength)
	for i := range bytes {
		var randomByte [1]byte
		if _, err := crand.Read(randomByte[:]); err != nil {
			return ""
		}
		bytes[i] = inviteCodeAlphabet[int(randomByte[0])%len(inviteCodeAlphabet)]
	}
	return string(bytes)
}
