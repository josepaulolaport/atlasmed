# iOS Shorebird Signing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile CD workflow publish a signed iOS Shorebird release to TestFlight using the configured certificate, provisioning profile, and App Store Connect API key, while disabling Android deployment temporarily.

**Architecture:** The macOS store job materializes signing credentials into a temporary keychain and provisioning profile directory, validates their team and bundle identifiers, then builds with Shorebird and uploads through a Fastlane lane authenticated by App Store Connect API key. Android release/upload steps are removed from CI while Android helper files remain available for future reactivation.

**Tech Stack:** GitHub Actions, Flutter/FVM, Shorebird CLI, macOS `security`, Fastlane, App Store Connect API, Xcode signing.

---

### Task 1: Align the Xcode project with the production Apple team

**Files:**
- Modify: `apps/mobile/ios/Runner.xcodeproj/project.pbxproj`

- [ ] Replace every Runner `DEVELOPMENT_TEAM = 32RMUWK9UU;` with `DEVELOPMENT_TEAM = GNT83DZ768;`.
- [ ] Verify exactly three Runner build configurations use `GNT83DZ768`.
- [ ] Verify the bundle identifier remains `br.com.atlasmed.app`.

### Task 2: Authenticate Fastlane with the App Store Connect API key

**Files:**
- Modify: `apps/mobile/fastlane/Fastfile`
- Modify: `apps/mobile/fastlane/Appfile`

- [ ] Change the default platform to iOS while Android deployment is disabled.
- [ ] Build an `api_key` value with `app_store_connect_api_key`, reading `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, and the materialized `APP_STORE_CONNECT_KEY_PATH`.
- [ ] Pass `api_key` and `APPLE_TEAM_ID` to `upload_to_testflight`.
- [ ] Remove the unused `APPLE_ITC_TEAM_ID` dependency.
- [ ] Update comments so the Appfile documents the active iOS-only release path.

### Task 3: Install and validate iOS signing credentials on the runner

**Files:**
- Modify: `.github/workflows/deploy-mobile-main.yml`

- [ ] Add a preflight step that requires all Shorebird, signing, and App Store Connect secrets.
- [ ] Materialize the `.p12`, `.mobileprovision`, and `.p8` under `$RUNNER_TEMP`.
- [ ] Create and unlock a temporary keychain, import the `.p12`, configure key partition access, and add the keychain to the search list.
- [ ] Decode the provisioning profile, extract its UUID, install it in `~/Library/MobileDevice/Provisioning Profiles`, and verify Team ID `GNT83DZ768` and application identifier `GNT83DZ768.br.com.atlasmed.app`.
- [ ] Run `shorebird release ios` only after signing validation.
- [ ] Locate the generated IPA, export its path as `SHOREBIRD_ARTIFACT_PATH`, and upload it with Fastlane.
- [ ] Always delete temporary signing files, installed profile, and keychain.

### Task 4: Disable Android deployment temporarily

**Files:**
- Modify: `.github/workflows/deploy-mobile-main.yml`
- Modify: `apps/mobile/shorebird-patches.json`
- Modify: `apps/mobile/Makefile`
- Modify: `AGENTS.md`

- [ ] Remove Android release and Google Play upload steps from the store job.
- [ ] Remove Android entries from the patch manifest and keep only the iOS release target.
- [ ] Change `store-release` to build iOS only, retaining the explicit `android` target for future local reactivation.
- [ ] Update documentation to state that native CD is temporarily iOS-only.

### Task 5: Validate and update the draft PR

**Files:**
- Validate all touched files.

- [ ] Parse all modified workflow YAML files.
- [ ] Run shell syntax validation on `scripts/resolve-shorebird-patches.sh`.
- [ ] Run `make -n ios`, `make -n store-release`, and `make -n patch-plan`.
- [ ] Run targeted searches confirming no active Android deployment and no `APPLE_ITC_TEAM_ID` dependency.
- [ ] Review `git diff --check` and the final diff.
- [ ] Commit the changes and push the branch backing draft PR #100.
