# ── Makefile — AtlasMed Mobile ──────────────────────────────────────
# Targets de build, release, patch e deploy.
#
# Pré-requisitos:
#   - Flutter SDK (via FVM) — ver .fvmrc
#   - Shorebird CLI — https://docs.shorebird.dev/
#   - Cider CLI — dart pub global activate cider
#   - Ruby/Bundler — para Fastlane (opcional, apenas store releases)
#
# Uso:
#   make android              # Shorebird release Android
#   make ios                  # Shorebird release iOS
#   make bump-minor           # Cider bump minor + CHANGELOG
#   make bump-patch           # Cider bump patch + CHANGELOG
#   make patch-plan           # Executa patches do manifest
#   make patch-release        # Bump patch + patches
#   make store-release        # Bump minor + ambos os stores
#   make web                  # Flutter build web + Firebase deploy
# ──────────────────────────────────────────────────────────────────────

SHELL := /bin/bash
.ONESHELL:

FVM        := fvm
FLUTTER    := $(FVM) flutter
SHOREBIRD  := shorebird
CIDER      := cider
BUNDLE     := bundle

# ── Flavor ─────────────────────────────────────────────────────────
FLAVOR     := production
CONFIG     := config.$(FLAVOR).json

# ── Flags compartilhadas ───────────────────────────────────────────
SB_RELEASE_FLAGS := --no-confirm
SB_PATCH_FLAGS   := --no-confirm --allow-asset-diffs --allow-native-diffs
FLUTTER_BUILD_FLAGS := --dart-define-from-file=$(CONFIG) --no-tree-shake-icons

########################################################################
# 🔢 Versionamento
########################################################################

.PHONY: bump-minor
bump-minor:
	$(CIDER) bump minor --bump-build
	$(CIDER) release

.PHONY: bump-patch
bump-patch:
	$(CIDER) bump patch --bump-build
	$(CIDER) release

########################################################################
# 📱 Shorebird Releases (Store)
########################################################################

.PHONY: android
android:
	$(SHOREBIRD) release android \
		$(SB_RELEASE_FLAGS) \
		--artifact aab \
		--flutter-version=$$(jq -r '.flutter' .fvmrc) \
		-- $(FLUTTER_BUILD_FLAGS)

.PHONY: ios
ios:
	$(SHOREBIRD) release ios \
		$(SB_RELEASE_FLAGS) \
		--flutter-version=$$(jq -r '.flutter' .fvmrc) \
		-- $(FLUTTER_BUILD_FLAGS)

.PHONY: store-release
store-release: bump-minor android ios

########################################################################
# 🩹 Shorebird Patches (OTA)
########################################################################

.PHONY: patch-plan
patch-plan:
	./scripts/resolve-shorebird-patches.sh run

.PHONY: patch-target
patch-target:
	$(SHOREBIRD) patch \
		$(SB_PATCH_FLAGS) \
		--platforms=$(PLATFORMS) \
		--release-version=$(RELEASE_VERSION) \
		-- $(FLUTTER_BUILD_FLAGS)

.PHONY: patch
patch: patch-plan

.PHONY: patch-release
patch-release: bump-patch patch-plan

########################################################################
# 🌐 Web (Firebase Hosting)
########################################################################

.PHONY: web
web:
	$(FLUTTER) build web --release $(FLUTTER_BUILD_FLAGS)
	firebase deploy --only hosting --project atlasmed-app

########################################################################
# 🧪 Desenvolvimento
########################################################################

.PHONY: get
get:
	$(FLUTTER) pub get

.PHONY: analyze
analyze:
	$(FLUTTER) analyze

.PHONY: test
test:
	$(FLUTTER) test

.PHONY: clean
clean:
	$(FLUTTER) clean

.PHONY: upgrade
upgrade:
	$(FLUTTER) pub upgrade --major-versions

########################################################################
# 🚀 CI Helpers
########################################################################

# Usado no CI para verificar se o Firestore/Shorebird estão OK
.PHONY: ci-check
ci-check:
	$(SHOREBIRD) --version
	$(CIDER) --version
	$(FLUTTER) --version
