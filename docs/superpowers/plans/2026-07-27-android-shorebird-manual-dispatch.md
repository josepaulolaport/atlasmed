# Android Shorebird and Manual Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reactivate signed Android Shorebird releases and Google Play internal uploads, and add a safe manual workflow dispatch with dry-run enabled by default.

**Architecture:** Android signing credentials and the Play service account are materialized only in the deployment job and removed afterward. Manual runs accept an explicit store/patch mode and dry-run flag; dry runs validate credentials and build native artifacts without creating Shorebird releases, patches, store uploads, or version commits.

**Tech Stack:** GitHub Actions, Flutter/FVM, Shorebird CLI, Gradle Kotlin DSL, Fastlane supply, Java keytool.

---

### Task 1: Configure Android release signing

**Files:**
- Modify: `apps/mobile/android/app/build.gradle.kts`
- Create: `apps/mobile/scripts/setup-android-signing.sh`
- Create: `apps/mobile/scripts/cleanup-android-signing.sh`

- [ ] Load `android/key.properties` before the Android block.
- [ ] Define a release signing config only when `key.properties` exists.
- [ ] Make release builds use that config and fail when signing is absent.
- [ ] Materialize the keystore and `key.properties` from GitHub secrets.
- [ ] Verify the keystore alias using `keytool -list`.
- [ ] Remove all temporary Android credentials after the job.

### Task 2: Restore Google Play upload

**Files:**
- Modify: `apps/mobile/fastlane/Fastfile`
- Modify: `.github/workflows/deploy-mobile-main.yml`

- [ ] Restore the Android `upload_internal` lane using `PLAY_STORE_SERVICE_ACCOUNT_JSON_PATH`.
- [ ] Decode `PLAY_STORE_SERVICE_ACCOUNT_JSON_BASE64` into `$RUNNER_TEMP`.
- [ ] Build a signed AAB through `shorebird release android`.
- [ ] Resolve the generated AAB path and upload package `br.com.atlasmed.app` as a completed release on the internal track.
- [ ] Run Android and iOS store releases sequentially in the macOS store job so both share one Cider version bump.

### Task 3: Add safe workflow dispatch

**Files:**
- Modify: `.github/workflows/deploy-mobile-main.yml`

- [ ] Add `workflow_dispatch` inputs `mode` (`store` or `patch`) and `dry_run` (boolean, default true).
- [ ] Make manual mode override automatic mode resolution.
- [ ] Skip Cider version bumps and git commits for every dry run.
- [ ] For store dry runs, use `shorebird release android --dry-run` and `shorebird release ios --dry-run`, and skip Google Play/TestFlight uploads.
- [ ] Patch mode never bumps the package version; each manifest entry targets an existing Shorebird release.
- [ ] For patch dry runs, add `--dry-run` to each manifest patch.
- [ ] Keep push-to-main behavior as a real deployment.

### Task 4: Restore dual-platform patch configuration and docs

**Files:**
- Modify: `apps/mobile/shorebird-patches.json`
- Modify: `apps/mobile/scripts/resolve-shorebird-patches.sh`
- Modify: `apps/mobile/Makefile`
- Modify: `AGENTS.md`

- [ ] Restore Android and iOS manifest entries.
- [ ] Allow the patch script to append `--dry-run` when `SHOREBIRD_DRY_RUN=true`.
- [ ] Restore `store-release` to Android and iOS.
- [ ] Document manual dry-run and dual-platform CD behavior.

### Task 5: Verify and update PR

**Files:**
- Validate all touched files.

- [ ] Parse and format the workflow YAML.
- [ ] Run Bash syntax checks and smoke tests for Android materialization/cleanup.
- [ ] Run Gradle configuration validation with a temporary keystore/key.properties where feasible.
- [ ] Run Makefile dry runs for Android, iOS, store release, and patches.
- [ ] Verify dry-run guards prevent store uploads and version commits.
- [ ] Run `git diff --check`, commit, rebase if needed, and push draft PR #100.
