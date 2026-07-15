# Mobile App — Hardcoded/Mock Data Audit

**Date:** 2026-07-15  
**Scope:** All `*.dart` files under `apps/mobile/lib/features/` and `apps/mobile/lib/core/`  

## Summary

| Category | Count |
|---|---|
| Fully stubbed screens ("Em breve") | 3 |
| Partially hardcoded detail data (fields defaulted when API has them) | 2 screens + 2 models |
| Hardcoded fallback strings shown to user | 3 screens |
| Empty clinic/doctor selections with TODO to wire | 1 screen |
| Mock repository references | 0 |
| `Future.delayed` simulating API calls | 0 |

---

## Screens

### Fully stubbed screens

| Screen | Hardcoded Data | Current Source | API Available? | Recommendation |
|---|---|---|---|---|
| `dashboard/presentation/screens/dashboard_screen.dart` | Full stub — "Em breve" placeholder with icon. No data loading. | Inline widget | ❌ | Needs a dashboard/performance summary endpoint |
| `presentations/presentation/screens/presentations_screen.dart` | Full stub — "Em breve" placeholder with icon. No data loading. | Inline widget | ❌ | Needs presentations endpoint or may be deprecated |
| `orders/presentation/screens/orders_screen.dart` | Full stub — "Em breve" placeholder with icon. **Does NOT delegate to `MyOrdersScreen`.** There is a separate `MyOrdersScreen` that is properly wired, but this stub appears to be the top-level orders tab. | Inline widget | ❌ (top-level stub) | Replace with navigation to `MyOrdersScreen` or remove if unused |

### Partially hardcoded detail screens

| Screen | Hardcoded Data | Current Source | API Available? | Recommendation |
|---|---|---|---|---|
| `explore/presentation/screens/clinic_detail_screen.dart` | Uses `ClinicDetail` from `clinicDetailProvider`; the provider (`_fetchClinicDetail()` in `explore_provider.dart`) maps from `ApiClinic` but **leaves many fields as defaults**: `neighborhood: ''`, `status: ClinicStatus.active`, `lastVisitDays: null`, `fieldNotes: null`, `isPriority: false`, `products: []`, `region: null`, `segment: null`, `consultantName: null`. The API response (`ApiClinic` from `GET /api/v1/facilities/:id`) contains `city`, `state`, `phone`, `email`, `website`, `streetAddress`, `cnpj` but **lacks** most detail fields (status, LTV, avgTicket, signals, payers, visits, doctors, productPerformance, nearbyClinics). | Mapped from real API via `ApiClinic` | ⚠️ Partial | Expand backend `/api/v1/facilities/:id` endpoint to return all fields consumed by `ClinicDetail`, then map them in `_fetchClinicDetail()` |
| `explore/presentation/screens/doctor_detail_screen.dart` | Uses `DoctorDetail` from `doctorDetailProvider`; the provider (`_fetchDoctorDetail()` in `explore_provider.dart`) maps from `ApiDoctor` but **leaves most fields as null/defaults**: `hue: 0`, `phone: null`, `email: null`, `whatsapp: null`, `birthday: null`, `faculty: null`, `residency: null`, `team: null`, `interests: null`, `language: null`, `statusLabel: ''`, `relationshipLabel: ''`, `notes: const []`, `clinics: const []`, `gallery: const []`, `signals: const []`, `prescribing: const []`, `visits: const []`. The API (`ApiDoctor` from `GET /api/v1/professionals/:id`) only has `id`, `firstName`, `lastName`, `fullName`, `specialty`, `crmNumber`, `crmState`, `facilityIds`, `distanceKm`. | Mapped from real API via `ApiDoctor` | ⚠️ Partial | Expand backend `/api/v1/professionals/:id` endpoint with all DoctorDetail fields, then map them in `_fetchDoctorDetail()` |
| `profile/presentation/screens/profile_screen.dart` | The `region` display comes from `UserProfile.region` which is hardcoded as `'Sem território definido'` in both `profileProvider` and `sessionProfileProvider`. Territory name is never resolved from the API. | Hardcoded string in provider | ⚠️ UserAssignments has territory IDs only | Needs territory name resolution in assignments API or a separate territory/name endpoint |
| `map/presentation/screens/map_screen.dart` | The `MapRepository.fromJson()` (line 64-68) returns a dummy `MapData` with `latitude: 0, longitude: 0`. This method is never called in practice because the provider uses `getAssignedTerritory()` and `getNearbyFacilities()` directly. Not a runtime bug, but misleading. | Dummy data in unused `fromJson()` | ✅ Properly wired | Remove the misleading dummy `fromJson()` or make it throw `UnimplementedError` |

### Order screens with hardcoded fallback data

| Screen | Hardcoded Data | Current Source | API Available? | Recommendation |
|---|---|---|---|---|
| `orders/presentation/screens/order_tracking_screen.dart` | `_mapToTrackingOrder()` produces: `estimatedDelivery: ''`, clinic `address: ''`, item `unit: ''`, synthetic timeline with **only 2 generic events** (confirmed + last update), `driver: null`. | Mapped from real API (`ApiOrderDetail`) | ✅ Real `GET /api/v1/orders/:id` endpoint exists | Backend should provide `estimatedDelivery`, clinic address, unit, timeline events, and driver info. Until then these are empty fallbacks |
| `orders/presentation/screens/order_success_screen.dart` | Hardcoded fallbacks: clinic name `'Clínica Santa Mônica'`, doctor name `'Dra. Mariana Silva'`, order ID `'PED-2042'`, delivery estimate `'25 a 29 de abril de 2026'`. The `_HeroSection` shows `'PED-2042'` as literal. | Local cart state + hardcoded fallbacks | ✅ Cart state is the source | Use the actual order ID returned by the create-order API response; show real delivery ETA; remove fake names |
| `orders/presentation/screens/checkout_screen.dart` | Clinic selection sheet has **empty list** (`...<SelectableClinic>[]`). Doctor selection sheet is **empty** (`final doctors = <SelectableDoctor>[]`). Source comments acknowledge: `// TODO: fetch real clinic list via FacilitiesRepository` and `// TODO: fetch real doctor list via ProfessionalsRepository filtered by clinicId`. | Inline `[]` | ✅ `GET /api/v1/facilities` and `GET /api/v1/professionals?facilityId=...` exist | Wire clinic picker to `FacilitiesRepository` and doctor picker to `ProfessionalsRepository` |

---

## Model / Data files

| File | Hardcoded Data | Current Source | API Available? | Recommendation |
|---|---|---|---|---|
| `features/explore/data/models/clinic.dart` | `Clinic.fromApi()` defaults: `neighborhood: ''`, `status: ClinicStatus.active`, `lastVisitDays: null`, `isPriority: false`, `products: []`, `distanceKm: 0` when API has null. `ApiClinic` has `city`, `state`, `consultantName`, `distanceKm`, `services`, `phone`, `email`, `website`, `streetAddress`, `cnpj` but many UI-needed fields (status, lastVisitDays, etc.) are **not present in the API response**. | `ApiClinic` → `Clinic` mapping | ⚠️ API response missing fields | Add `status`, `lastVisitDays`, `isPriority`, `products`, `distanceKm`, `neighborhood` to `ApiClinic` response, then map them |
| `features/explore/data/models/doctor.dart` | `Doctor.fromApi()` defaults: `hue: 0`, `specialty: ''` (when API has null), `primaryClinic: ''`, `distanceKm: 0` (when API has null), `isPriority: false`. | `ApiDoctor` → `Doctor` mapping | ⚠️ API response missing fields | Add `primaryClinicName`, `isPriority`, `distanceKm`, `hue` to `ApiDoctor` response, then map them |
| `features/profile/data/models/user_profile.dart` | `UserProfile` model defaults: `since = ''`, `avatarHue = 220`. `region` field has no default but **all providers set it to hardcoded `'Sem território definido'`**. | Model + Provider | ⚠️ User/assignments API has territory IDs but no name | Add territory name to assignments API response; resolve real name in provider |
| `features/profile/data/models/territory.dart` | `TerritoryStats` defaults: `coverageWeek = 'esta semana'`. This default **is overwritten** in `territoryStatsProvider` with real computed dates (`'$day/$month – $day/$month'`). Not a user-facing issue. | Provider overwrites default | ✅ | Acceptable — the default is never exposed |
| `features/profile/presentation/providers/profile_provider.dart` | Both `profileProvider` and `sessionProfileProvider` hardcode `region: 'Sem território definido'` directly when constructing `UserProfile`. The `UserAssignments` API response has territory **IDs** but not names. | Inline string | ⚠️ API has IDs, not names | Backend should include territory `name` alongside `territoryId` in the assignments response |
| `features/orders/data/models/order.dart` | `OrderListItem` and `OrderDetail` models have **no `fromJson` factory**. They are constructed manually in `orders_provider.dart`, where API mapping is incomplete: `clinicAddress: ''`, `doctorCrm: ''`, `invoice: ''`, `tracking: ''`, `estimate: ''`, `timeline: [single synthetic step]`, `paymentMethod: order.notes ?? 'Informação não disponível'`. | Manual construction in provider | ✅ API response (`ApiOrderDetail`) has real data | Map all available fields from `ApiOrderDetail` to `OrderDetail`; add missing fields to API if needed |
| `features/orders/data/models/tracking.dart` | `TrackingOrderDetail`, `TrackingOrderItem`, `TrackingClinic`, `DriverInfo`, `PriceSuggestion` have **no `fromJson` factory**. They are constructed manually in `order_tracking_screen.dart` where many fields are left empty/zero. | Manual construction | ⚠️ Partially available | Add proper `fromJson` factories and map all available fields from the API response |
| `features/orders/data/models/cart.dart` | `Product` model (line 4 comment: `// ── Product model (mock) ─────────────────────`). This model is **duplicated** from `CatalogProduct` — it has fewer fields and is only used to display items in order detail screens. | Inline model | ✅ | Replace `Product` usage with `CatalogProduct` from the API |
| `core/user/models/user.dart` | None — proper `fromJson`/`toJson` with no hardcoded values. Acceptable. | API | ✅ | No action needed |
| `core/session/repositories/session_environment.dart` | None — properly wired to `POST /api/v1/session/`, `PUT /api/v1/session/`, `DELETE /api/v1/session/`. Acceptable. | API | ✅ | No action needed |

---

## Files verified as clean (no hardcoded data)

These were checked and found to be properly wired to real APIs or pure UI/presentation:

- `auth/presentation/screens/login_screen.dart` — uses `SessionEnvironment.login()`
- `auth/presentation/screens/forgot_email_screen.dart` — uses `SessionEnvironment.requestPasswordReset()`
- `auth/presentation/screens/forgot_code_screen.dart` — uses `SessionEnvironment.verifyResetCode()`
- `auth/presentation/screens/forgot_new_password_screen.dart` — uses `SessionEnvironment.resetPassword()`
- `auth/presentation/screens/forgot_success_screen.dart` — pure UI, no data
- `auth/presentation/screens/splash_screen.dart` — pure UI, no data
- `auth/presentation/providers/auth_provider.dart` — local state holder (acceptable)
- `explore/presentation/screens/explore_screen.dart` — properly wired to real API
- `explore/data/professional_note.dart` — proper `fromJson`
- `explore/data/api_types.dart` — proper `fromMap` factories for all API types
- `location/data/location_service.dart` — pure platform service (no remote data)
- `map/presentation/providers/map_provider.dart` — properly wired to real API
- `map/data/models/` — pure value objects (no hardcoded values)
- `map/data/repositories/map_repository.dart` — properly wired (except unused dummy `fromJson`)
- `visits/` — properly wired to `GET /api/v1/visits/weekly-summary`
- `orders/presentation/screens/my_orders_screen.dart` — uses real API
- `orders/presentation/screens/order_detail_screen.dart` — uses real API
- `orders/presentation/screens/new_order_products_screen.dart` — uses real API
- `orders/data/catalog_product.dart` — proper `fromJson`
- `orders/data/repositories/` — proper HTTP calls
- `core/user/` — proper `fromJson`/`toJson` for all models
- `core/session/` — proper API calls

---

## Top Priorities

1. **Checkout screen**: Wire clinic picker to `FacilitiesRepository` and doctor picker to `ProfessionalsRepository` (two TODO comments)
2. **Orders stub**: Either replace `orders_screen.dart` stub with a redirect to `MyOrdersScreen`, or remove it
3. **Order success screen**: Use real order ID, real clinic/doctor names, real delivery ETA from API response
4. **Profile territory**: Resolve territory name from the assignments API (backend needs to include name alongside ID)
5. **Detail screens**: Expand backend endpoints (`/api/v1/facilities/:id` and `/api/v1/professionals/:id`) to return all fields consumed by `ClinicDetail` and `DoctorDetail`
6. **Order tracking**: Backend should provide `estimatedDelivery`, clinic address, timeline events, and driver info
