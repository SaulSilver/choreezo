# Choreezo App Store Metadata Pack

This folder contains the first implementation of iOS App Store metadata for Choreezo.

## Files

- [ios-metadata.en-US.md](ios-metadata.en-US.md): Ready-to-paste App Store Connect listing text.
- [screenshots-plan.md](screenshots-plan.md): Screenshot capture sequence and shot list.
- [privacy-mapping.md](privacy-mapping.md): App Privacy questionnaire mapping from app behavior.

## Implementation Order

1. Confirm identity values before filling App Store Connect:
- iOS bundle identifier: `com.saulsilver.choreezo`.
- Version and build number from release build.
2. Paste listing text from [ios-metadata.en-US.md](ios-metadata.en-US.md).
3. Capture and upload screenshots from [screenshots-plan.md](screenshots-plan.md).
4. Answer App Privacy using [privacy-mapping.md](privacy-mapping.md).
5. Run final consistency check against app binary before submission.

## Open Decisions

1. Keep or remove the Face ID usage key if not required by runtime behavior.
2. Confirm final platform identity messaging (iOS bundle id differs from Android package/docs).
3. Confirm account deletion wording for review notes and support documentation.
