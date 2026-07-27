# Mobile Stateful Shell Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authenticated root screens explicit `StatefulShellRoute` branches, ensure details open outside the drawer shell, and rename internal mobile paths to English.

**Architecture:** A root `GlobalKey<NavigatorState>` owns details and full-screen flows. `StatefulShellRoute.indexedStack` owns only drawer landing screens. The shell renders a `StatefulNavigationShell`; drawer metadata stores the matching branch index and drives selection through `goBranch`, never via route-prefix matching.

**Tech Stack:** Flutter, Dart, go_router 14, flutter_test.

---

### Task 1: Lock down drawer branch selection

**Files:**
- Create: `apps/mobile/test/shared/widgets/app_shell_test.dart`
- Modify: `apps/mobile/lib/shared/widgets/app_shell.dart`

- [ ] **Step 1: Write a failing widget/unit test**

Assert that the selected item is calculated from an injected active branch index and that navigation uses the configured branch index rather than a URL string.

- [ ] **Step 2: Run the focused test**

Run: `cd apps/mobile && flutter test test/shared/widgets/app_shell_test.dart`
Expected: failure because branch-index navigation is not exposed yet.

- [ ] **Step 3: Add branch-based drawer API**

Make `AppShellScreen` accept `StatefulNavigationShell`; replace `activeSection` with the active branch index and a callback that calls `navigationShell.goBranch`.

- [ ] **Step 4: Re-run focused test**

Run: `cd apps/mobile && flutter test test/shared/widgets/app_shell_test.dart`
Expected: pass.

### Task 2: Separate shell branches from root detail routes

**Files:**
- Modify: `apps/mobile/lib/app.dart`
- Modify: `apps/mobile/lib/shared/widgets/app_shell.dart`

- [ ] **Step 1: Write a failing routing test**

Extend `app_shell_test.dart` to assert a detail route is hosted by the root navigator and does not expose the shell drawer.

- [ ] **Step 2: Run the focused test**

Run: `cd apps/mobile && flutter test test/shared/widgets/app_shell_test.dart`
Expected: failure because child detail routes still belong to the shell.

- [ ] **Step 3: Implement root/shell navigator split**

Declare `_rootNavigatorKey`, replace `ShellRoute` with `StatefulShellRoute.indexedStack`, keep only drawer landing screens in branches, and set `parentNavigatorKey: _rootNavigatorKey` for every detail/edit/flow route.

- [ ] **Step 4: Re-run focused test**

Run: `cd apps/mobile && flutter test test/shared/widgets/app_shell_test.dart`
Expected: pass.

### Task 3: Rename authenticated paths and callers

**Files:**
- Modify: `apps/mobile/lib/app.dart`
- Modify: every Dart file returned by the route-path search under `apps/mobile/lib/`

- [ ] **Step 1: Write a failing route vocabulary test**

Assert the routing configuration exposes English paths such as `/explore`, `/orders/new`, and `/territories/:id/edit`.

- [ ] **Step 2: Run the focused test**

Run: `cd apps/mobile && flutter test test/shared/widgets/app_shell_test.dart`
Expected: failure because legacy Portuguese paths remain.

- [ ] **Step 3: Apply the approved path map**

Replace all approved top-level and child paths in declarations and every `go`/`push` caller. Do not change Portuguese UI copy or domain/API field names.

- [ ] **Step 4: Re-run focused test**

Run: `cd apps/mobile && flutter test test/shared/widgets/app_shell_test.dart`
Expected: pass.

### Task 4: Verify the migration

**Files:**
- Modify: `docs/superpowers/specs/2026-07-27-mobile-stateful-shell-routing-design.md`

- [ ] **Step 1: Format touched Dart files**

Run: `cd apps/mobile && dart format lib test/shared/widgets/app_shell_test.dart`

- [ ] **Step 2: Run all mobile tests**

Run: `cd apps/mobile && flutter test`
Expected: pass.

- [ ] **Step 3: Run static analysis**

Run: `cd apps/mobile && flutter analyze`
Expected: no issues.

- [ ] **Step 4: Inspect the final diff and commit**

Run: `git diff --check && git diff -- apps/mobile docs/superpowers`
Then commit only the routing implementation, regression test, plan, and design document.
