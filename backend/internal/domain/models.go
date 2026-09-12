package domain

import (
	"context"
	"time"
)

type Profile struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Email        *string `json:"email,omitempty"`
	AuthProvider *string `json:"authProvider,omitempty"`
	ApartmentID  *string `json:"apartmentId"`
	IsDemoUser   bool    `json:"isDemoUser"`
	NotifyDaily  bool    `json:"notifyDaily"`
	NotifyWeekly bool    `json:"notifyWeekly"`
}

type Apartment struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	IsDemo     bool   `json:"isDemo"`
	InviteCode string `json:"inviteCode"`
	Timezone   string `json:"timezone"`
	CreatedBy  string `json:"createdBy"`
}

type Member struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	IsDemoUser bool   `json:"isDemoUser"`
}

type Chore struct {
	ID   string  `json:"id"`
	Name string  `json:"name"`
	Icon *string `json:"icon,omitempty"`
}

type Assignment struct {
	ID               string  `json:"id"`
	ApartmentID      string  `json:"apartmentId"`
	UserID           *string `json:"userId"`
	ChoreID          string  `json:"choreId"`
	Date             string  `json:"date"`
	WeekNumber       int     `json:"weekNumber"`
	ManuallyAssigned bool    `json:"manuallyAssigned"`
}

type UpdateProfileInput struct {
	Name         *string `json:"name"`
	Email        *string `json:"email"`
	NotifyDaily  *bool   `json:"notifyDaily"`
	NotifyWeekly *bool   `json:"notifyWeekly"`
}

type CreateApartmentInput struct {
	Name     string `json:"name"`
	Timezone string `json:"timezone"`
}

type JoinApartmentInput struct {
	InviteCode string `json:"inviteCode"`
}

type RegisterDeviceInput struct {
	DeviceID      string  `json:"deviceId"`
	ExpoPushToken string  `json:"expoPushToken"`
	Platform      *string `json:"platform,omitempty"`
}

type SetAssignmentUserInput struct {
	UserID *string `json:"userId"`
}

type API interface {
	GetProfile(ctx context.Context, uid string) (*Profile, error)
	UpdateProfile(ctx context.Context, uid string, input UpdateProfileInput) (*Profile, error)
	DeleteProfile(ctx context.Context, uid string) error
	RegisterDevice(ctx context.Context, uid string, input RegisterDeviceInput) error
	UnregisterDevice(ctx context.Context, uid string, deviceID string) error
	CreateApartment(ctx context.Context, uid string, input CreateApartmentInput) (*Apartment, error)
	CreateDemoApartment(ctx context.Context, uid string) (*Apartment, error)
	JoinApartment(ctx context.Context, uid string, input JoinApartmentInput) (*Apartment, error)
	GetApartment(ctx context.Context, uid string, apartmentID string) (*Apartment, error)
	GetApartmentMembers(ctx context.Context, uid string, apartmentID string) ([]Member, error)
	LeaveApartment(ctx context.Context, uid string, apartmentID string) error
	DeleteApartment(ctx context.Context, uid string, apartmentID string) error
	ClearDemoApartment(ctx context.Context, uid string, apartmentID string) error
	ListChores(ctx context.Context, uid string, apartmentID string) ([]Chore, error)
	GetAssignmentsForWeek(ctx context.Context, uid string, apartmentID string, weekNumber int) ([]Assignment, error)
	EnsureAssignmentsForWeek(ctx context.Context, uid string, apartmentID string, weekNumber int) ([]Assignment, error)
	ClaimAssignment(ctx context.Context, uid string, apartmentID string, assignmentID string) (*Assignment, error)
	UnclaimAssignment(ctx context.Context, uid string, apartmentID string, assignmentID string) (*Assignment, error)
	SetAssignmentUser(ctx context.Context, uid string, apartmentID string, assignmentID string, targetUserID *string) (*Assignment, error)
}

type userRecord struct {
	Name          string     `firestore:"name,omitempty"`
	Email         *string    `firestore:"email,omitempty"`
	AuthProvider  *string    `firestore:"authProvider,omitempty"`
	ApartmentID   *string    `firestore:"apartmentId"`
	IsDemoUser    bool       `firestore:"isDemoUser,omitempty"`
	ExpoPushToken *string    `firestore:"expoPushToken,omitempty"`
	NotifyDaily   bool       `firestore:"notifyDaily,omitempty"`
	NotifyWeekly  bool       `firestore:"notifyWeekly,omitempty"`
	CreatedAt     *time.Time `firestore:"createdAt,omitempty"`
	UpdatedAt     *time.Time `firestore:"updatedAt,omitempty"`
}

type apartmentRecord struct {
	Name       string     `firestore:"name,omitempty"`
	IsDemo     bool       `firestore:"isDemo,omitempty"`
	InviteCode string     `firestore:"inviteCode,omitempty"`
	Timezone   string     `firestore:"timezone,omitempty"`
	CreatedBy  string     `firestore:"createdBy,omitempty"`
	CreatedAt  *time.Time `firestore:"createdAt,omitempty"`
	UpdatedAt  *time.Time `firestore:"updatedAt,omitempty"`
}

type choreRecord struct {
	ID        string     `firestore:"id,omitempty"`
	Name      string     `firestore:"name,omitempty"`
	Icon      *string    `firestore:"icon,omitempty"`
	CreatedAt *time.Time `firestore:"createdAt,omitempty"`
	UpdatedAt *time.Time `firestore:"updatedAt,omitempty"`
}

type assignmentRecord struct {
	ID               string     `firestore:"id,omitempty"`
	ApartmentID      string     `firestore:"apartmentId,omitempty"`
	UserID           *string    `firestore:"userId"`
	ChoreID          string     `firestore:"choreId,omitempty"`
	Date             string     `firestore:"date,omitempty"`
	WeekNumber       int        `firestore:"weekNumber,omitempty"`
	ManuallyAssigned bool       `firestore:"manuallyAssigned,omitempty"`
	CreatedAt        *time.Time `firestore:"createdAt,omitempty"`
	UpdatedAt        *time.Time `firestore:"updatedAt,omitempty"`
}
