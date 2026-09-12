package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/SaulSilver/choreezo/backend/internal/auth"
	"github.com/SaulSilver/choreezo/backend/internal/domain"
)

type v1Handler struct {
	service domain.API
}

func newV1Handler(service domain.API) http.Handler {
	return v1Handler{service: service}
}

func (h v1Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	identity, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		WriteError(w, r, http.StatusUnauthorized, "unauthorized", "invalid authentication token")
		return
	}

	path := strings.TrimSuffix(r.URL.Path, "/")
	if path == "" {
		path = "/"
	}
	segments := splitPath(path)
	if len(segments) < 2 || segments[0] != "v1" {
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		return
	}

	switch {
	case len(segments) == 2 && segments[1] == "me":
		h.handleProfile(w, r, identity.UID)
	case len(segments) == 3 && segments[1] == "me" && segments[2] == "devices":
		h.handleDeviceRegistration(w, r, identity.UID)
	case len(segments) == 4 && segments[1] == "me" && segments[2] == "devices":
		h.handleDeviceUnregistration(w, r, identity.UID, segments[3])
	case len(segments) == 2 && segments[1] == "apartments":
		h.handleApartmentsCollection(w, r, identity.UID)
	case len(segments) == 3 && segments[1] == "apartments" && segments[2] == "join":
		h.handleApartmentJoin(w, r, identity.UID)
	case len(segments) == 3 && segments[1] == "apartments" && segments[2] == "demo":
		h.handleApartmentDemoCreate(w, r, identity.UID)
	case len(segments) == 3 && segments[1] == "apartments":
		h.handleApartmentResource(w, r, identity.UID, segments[2])
	case len(segments) == 4 && segments[1] == "apartments" && segments[3] == "members":
		h.handleApartmentMembers(w, r, identity.UID, segments[2])
	case len(segments) == 4 && segments[1] == "apartments" && segments[3] == "leave":
		h.handleApartmentLeave(w, r, identity.UID, segments[2])
	case len(segments) == 5 && segments[1] == "apartments" && segments[3] == "demo" && segments[4] == "clear":
		h.handleApartmentDemoClear(w, r, identity.UID, segments[2])
	case len(segments) == 4 && segments[1] == "apartments" && segments[3] == "chores":
		h.handleChoreList(w, r, identity.UID, segments[2])
	case len(segments) == 4 && segments[1] == "apartments" && segments[3] == "assignments":
		h.handleAssignmentsCollection(w, r, identity.UID, segments[2])
	case len(segments) == 5 && segments[1] == "apartments" && segments[3] == "assignments" && segments[4] == "ensure":
		h.handleAssignmentsEnsure(w, r, identity.UID, segments[2])
	case len(segments) == 6 && segments[1] == "apartments" && segments[3] == "assignments" && segments[5] == "claim":
		h.handleAssignmentClaim(w, r, identity.UID, segments[2], segments[4])
	case len(segments) == 6 && segments[1] == "apartments" && segments[3] == "assignments" && segments[5] == "unclaim":
		h.handleAssignmentUnclaim(w, r, identity.UID, segments[2], segments[4])
	case len(segments) == 6 && segments[1] == "apartments" && segments[3] == "assignments" && segments[5] == "assign":
		h.handleAssignmentSetUser(w, r, identity.UID, segments[2], segments[4])
	default:
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
	}
}

func (h v1Handler) ensureService(w http.ResponseWriter, r *http.Request) bool {
	if h.service != nil {
		return true
	}
	WriteError(w, r, http.StatusServiceUnavailable, "service_unavailable", "domain service is not configured")
	return false
}

func (h v1Handler) handleProfile(w http.ResponseWriter, r *http.Request, uid string) {
	if !h.ensureService(w, r) {
		return
	}
	switch r.Method {
	case http.MethodGet:
		profile, err := h.service.GetProfile(r.Context(), uid)
		if err != nil {
			writeServiceError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, profile)
	case http.MethodPatch:
		var input domain.UpdateProfileInput
		if err := decodeJSON(r, &input); err != nil {
			WriteError(w, r, http.StatusBadRequest, "invalid_json", err.Error())
			return
		}
		profile, err := h.service.UpdateProfile(r.Context(), uid, input)
		if err != nil {
			writeServiceError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, profile)
	case http.MethodDelete:
		if err := h.service.DeleteProfile(r.Context(), uid); err != nil {
			writeServiceError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
	}
}

func (h v1Handler) handleDeviceRegistration(w http.ResponseWriter, r *http.Request, uid string) {
	if !h.ensureService(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	var input domain.RegisterDeviceInput
	if err := decodeJSON(r, &input); err != nil {
		WriteError(w, r, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	if err := h.service.RegisterDevice(r.Context(), uid, input); err != nil {
		writeServiceError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h v1Handler) handleDeviceUnregistration(w http.ResponseWriter, r *http.Request, uid string, deviceID string) {
	if !h.ensureService(w, r) {
		return
	}
	if r.Method != http.MethodDelete {
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	if err := h.service.UnregisterDevice(r.Context(), uid, deviceID); err != nil {
		writeServiceError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h v1Handler) handleApartmentsCollection(w http.ResponseWriter, r *http.Request, uid string) {
	if !h.ensureService(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	var input domain.CreateApartmentInput
	if err := decodeJSON(r, &input); err != nil {
		WriteError(w, r, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	apartment, err := h.service.CreateApartment(r.Context(), uid, input)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, apartment)
}

func (h v1Handler) handleApartmentJoin(w http.ResponseWriter, r *http.Request, uid string) {
	if !h.ensureService(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	var input domain.JoinApartmentInput
	if err := decodeJSON(r, &input); err != nil {
		WriteError(w, r, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	apartment, err := h.service.JoinApartment(r.Context(), uid, input)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, apartment)
}

func (h v1Handler) handleApartmentDemoCreate(w http.ResponseWriter, r *http.Request, uid string) {
	if !h.ensureService(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	apartment, err := h.service.CreateDemoApartment(r.Context(), uid)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, apartment)
}

func (h v1Handler) handleApartmentResource(w http.ResponseWriter, r *http.Request, uid string, apartmentID string) {
	if !h.ensureService(w, r) {
		return
	}
	switch r.Method {
	case http.MethodGet:
		apartment, err := h.service.GetApartment(r.Context(), uid, apartmentID)
		if err != nil {
			writeServiceError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, apartment)
	case http.MethodDelete:
		if err := h.service.DeleteApartment(r.Context(), uid, apartmentID); err != nil {
			writeServiceError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
	}
}

func (h v1Handler) handleApartmentMembers(w http.ResponseWriter, r *http.Request, uid string, apartmentID string) {
	if !h.ensureService(w, r) {
		return
	}
	if r.Method != http.MethodGet {
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	members, err := h.service.GetApartmentMembers(r.Context(), uid, apartmentID)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"members": members})
}

func (h v1Handler) handleApartmentLeave(w http.ResponseWriter, r *http.Request, uid string, apartmentID string) {
	if !h.ensureService(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	if err := h.service.LeaveApartment(r.Context(), uid, apartmentID); err != nil {
		writeServiceError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h v1Handler) handleApartmentDemoClear(w http.ResponseWriter, r *http.Request, uid string, apartmentID string) {
	if !h.ensureService(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	if err := h.service.ClearDemoApartment(r.Context(), uid, apartmentID); err != nil {
		writeServiceError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h v1Handler) handleChoreList(w http.ResponseWriter, r *http.Request, uid string, apartmentID string) {
	if !h.ensureService(w, r) {
		return
	}
	if r.Method != http.MethodGet {
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	chores, err := h.service.ListChores(r.Context(), uid, apartmentID)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"chores": chores})
}

func (h v1Handler) handleAssignmentsCollection(w http.ResponseWriter, r *http.Request, uid string, apartmentID string) {
	if !h.ensureService(w, r) {
		return
	}
	if r.Method != http.MethodGet {
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	weekNumber, err := weekNumberFromRequest(r)
	if err != nil {
		WriteError(w, r, http.StatusBadRequest, "invalid_week_number", err.Error())
		return
	}
	assignments, err := h.service.GetAssignmentsForWeek(r.Context(), uid, apartmentID, weekNumber)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"assignments": assignments})
}

func (h v1Handler) handleAssignmentsEnsure(w http.ResponseWriter, r *http.Request, uid string, apartmentID string) {
	if !h.ensureService(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	weekNumber, err := weekNumberFromRequest(r)
	if err != nil {
		WriteError(w, r, http.StatusBadRequest, "invalid_week_number", err.Error())
		return
	}
	assignments, err := h.service.EnsureAssignmentsForWeek(r.Context(), uid, apartmentID, weekNumber)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"assignments": assignments})
}

func (h v1Handler) handleAssignmentClaim(w http.ResponseWriter, r *http.Request, uid string, apartmentID string, assignmentID string) {
	if !h.ensureService(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	assignment, err := h.service.ClaimAssignment(r.Context(), uid, apartmentID, assignmentID)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, assignment)
}

func (h v1Handler) handleAssignmentUnclaim(w http.ResponseWriter, r *http.Request, uid string, apartmentID string, assignmentID string) {
	if !h.ensureService(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	assignment, err := h.service.UnclaimAssignment(r.Context(), uid, apartmentID, assignmentID)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, assignment)
}

func (h v1Handler) handleAssignmentSetUser(w http.ResponseWriter, r *http.Request, uid string, apartmentID string, assignmentID string) {
	if !h.ensureService(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		WriteError(w, r, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	var input domain.SetAssignmentUserInput
	if err := decodeJSON(r, &input); err != nil {
		WriteError(w, r, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	assignment, err := h.service.SetAssignmentUser(r.Context(), uid, apartmentID, assignmentID, input.UserID)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, assignment)
}

func writeServiceError(w http.ResponseWriter, r *http.Request, err error) {
	var domainErr *domain.Error
	if errors.As(err, &domainErr) {
		WriteError(w, r, domainErr.Status, domainErr.Code, domainErr.Message)
		return
	}
	WriteError(w, r, http.StatusInternalServerError, "internal_error", "internal server error")
}

func splitPath(path string) []string {
	trimmed := strings.Trim(path, "/")
	if trimmed == "" {
		return nil
	}
	return strings.Split(trimmed, "/")
}

func decodeJSON(r *http.Request, target any) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		if err == nil {
			return errors.New("request body must contain a single JSON object")
		}
		return err
	}
	return nil
}

func weekNumberFromRequest(r *http.Request) (int, error) {
	value := strings.TrimSpace(r.URL.Query().Get("weekNumber"))
	if value == "" {
		return 0, errors.New("weekNumber query parameter is required")
	}
	return strconv.Atoi(value)
}
