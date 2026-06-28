# App Privacy Mapping (iOS)

Use this as a working sheet when completing App Store Connect App Privacy.

## Tracking

- Data used to track users: No (expected based on current code and dependencies).

## Data Types to Evaluate

1. Contact Info
- Data: Name, email (from Sign in with Apple when provided).
- Linked to user: Yes.
- Tracking: No.
- Purpose: App functionality (account/profile and apartment membership context).

2. Identifiers
- Data: User ID, Sign in with Apple stable identifier, push token.
- Linked to user: Yes.
- Tracking: No.
- Purpose: App functionality (sign-in continuity, notification delivery).

3. User Content
- Data: Apartment membership and chore assignments.
- Linked to user: Yes.
- Tracking: No.
- Purpose: App functionality (core scheduling and assignment features).

4. Diagnostics
- Data: None intentionally collected by app code.
- Linked to user: N/A.
- Tracking: N/A.
- Purpose: N/A.

## Permission and Capability Notes

1. Notifications permission is requested at runtime and can be declined.
2. Sign in with Apple is supported on iOS.
3. Camera/photo/microphone are not used by app behavior.
4. Face ID usage key should be confirmed as necessary before release.

## Final Verification Before Submit

1. Ensure App Store Connect answers match actual release behavior.
2. Re-verify data categories after any auth or analytics dependency changes.
3. Keep privacy policy text aligned with the selected App Privacy answers.
