# Hardcoded/Mock Data Audit — Mobile App Screens & Widgets

**Scope:** `apps/mobile/lib/features/` — all feature directories (auth, dashboard, explore, location, map, orders, presentations, profile, visits).

**Date:** 2026-07-09

**Method:** Each feature directory was scanned file-by-file for hardcoded data (string literals, const lists, `Future.delayed` in providers/repos, `Mock*` references, inline-constructed data in `build()`). Findings were cross-referenced against available API endpoints in `apps/api/src/modules/`.

---

## Summary

| Status | Count |
|---|---|
| ✅ Fully wired to real API | **5 features** (auth, explore, map, profile, visits) |
| ⚠️ Has mock/hardcoded data | **1 feature** (orders — 4 screens/widgets) |
| 🚧 Placeholder stub (no data) | **2 screens** (dashboard, presentations) |
| 🗑️ Dead/unused model files | **2 files** (activity.dart, support.dart) |

---

## Per-Feature Detail

### Auth — ✅ Fully Real API

All 7 screens and 6 widgets are wired via `SessionEnvironment` → real `RepositoryHttpClient`. No mock repositories, no `Future.delayed` returning fake data.

| Screen | Data | Current source | API available? | Recommendation |
|---|---|---|---|---|
| `login_screen.dart` | Auth session | `SessionEnvironment.login()` — real API `POST /api/v1/session/` | ✅ | None needed |
| `splash_screen.dart` | N/A — pure animation | N/A | N/A | None needed |
| `forgot_email_screen.dart` | Password reset request | `sessionProvider.requestPasswordReset()` — real API `POST /auth/forgot-password` | ⚠️ Route mismatch: API has `POST /api/v1/password-reset/request` | Align mobile endpoint to `/api/v1/password-reset/request` |
| `forgot_code_screen.dart` | Verify reset code | `sessionProvider.verifyResetCode()` — real API `POST /auth/verify-reset-code` | ❌ No matching endpoint in API | Needs verification endpoint or map to existing flow |
| `forgot_new_password_screen.dart` | Reset password | `sessionProvider.resetPassword()` — real API `POST /auth/reset-password` | ⚠️ Route mismatch: API has `POST /api/v1/password-reset/confirm` | Align mobile endpoint to `/api/v1/password-reset/confirm` |
| `forgot_success_screen.dart` | N/A — confirmation UI | N/A | N/A | None needed |

---

### Dashboard — 🚧 Placeholder Stub

| Screen | Data | Current source | API available? | Recommendation |
|---|---|---|---|---|
| `dashboard_screen.dart` | Entire screen is hardcoded "Em breve" stub | Inline string literals, color constants, icon | No dashboard endpoint exists | Design and implement dashboard API + wire mobile |

---

### Explore — ✅ Fully Real API

All 3 screens and 10 widgets are wired via `ClinicsRepository`, `DoctorsRepository`, `ProfessionalNotesRepository` → real API endpoints (`GET /api/v1/facilities`, `GET /api/v1/professionals`, `GET /api/v1/professionals/:id/notes`). No mock data.

| Screen | Data | Current source | API available? | Recommendation |
|---|---|---|---|---|
| `explore_screen.dart` | Clinic/doctor lists, search, sort | `ClinicsRepository`, `DoctorsRepository` → real API | ✅ | None needed |
| `clinic_detail_screen.dart` | Facility detail + notes | `_ClinicDetailRepository` → `GET /api/v1/facilities/:id` | ✅ | None needed |
| `doctor_detail_screen.dart` | Professional detail + notes | `_DoctorDetailRepository` → `GET /api/v1/professionals/:id` | ✅ | None needed |

**Note:** The `fromApi()` mappers in `clinic.dart` and `doctor.dart` default some fields (`neighborhood`, `status`, `lastVisitDays`, `isPriority`, `products`, `initials`, `hue`, `primaryClinic`) to empty/zero values because the paginated list API doesn't return them. This is an API completeness gap, not mock data.

---

### Location — ✅ Real Device GPS

| File | Data | Current source | API available? | Recommendation |
|---|---|---|---|---|
| `location_service.dart` | Device GPS coordinates | `Geolocator.getCurrentPosition()` (real device GPS) | N/A — device hardware | None needed |

---

### Map — ✅ Fully Real API

| Screen | Data | Current source | API available? | Recommendation |
|---|---|---|---|---|
| `map_screen.dart` | Territory boundary, nearby facilities | `MapRepository` → `GET /api/v1/territories/:id/boundary`, `GET /api/v1/facilities?...` | ✅ | None needed |

**Note:** `DeviceCurrentLocationService` falls back to São Paulo center coordinates (`-23.5505, -46.6333`) when `LocationService.requestCurrentLocation()` returns `LocationUnavailable`. This is a documented graceful fallback for the initial map view.

---

### Orders — ⚠️ Mixed (Real API + Mock Data)

#### Real API screens (no action needed):

| Screen | Data | Current source | API available? | Recommendation |
|---|---|---|---|---|
| `my_orders_screen.dart` | Order list | `OrdersRepository.listOrders()` → `GET /api/v1/orders` | ✅ | None needed |
| `new_order_products_screen.dart` | Product catalog | `CatalogRepository.getProducts()` → `GET /api/v1/products` | ✅ | None needed |
| `order_detail_screen.dart` | Order detail | `OrdersRepository.getOrder()` → `GET /api/v1/orders/:id` | ✅ | None needed |
| `cart_screen.dart` | Cart items (Riverpod state) | `cartProvider` (in-memory Riverpod state) | N/A — local state | None needed |

#### Screens/widgets still using mock data:

| Screen | Data | Current source | API available? | Recommendation |
|---|---|---|---|---|
| `order_tracking_screen.dart` | Tracking order detail (items, timeline, driver info, pricing) | **Fully mock** — reads `kTrackingOrders[widget.orderId]` from `legacy_orders_mock.dart` | ❌ No tracking endpoint exists | Needs new `GET /api/v1/orders/:id/tracking` endpoint + wire mobile |
| `checkout_screen.dart` | Clinic & doctor selectors | **Mock lists** — `kSelectorClinics` and `kSelectorDoctors` from `legacy_orders_mock.dart` | ❌ No endpoint exists | Needs endpoints: `GET /api/v1/checkout/clinics` and `GET /api/v1/checkout/doctors?clinicId=...` |
| `checkout_screen.dart` | Order submission (confirm button) | **No API call** — navigates to success screen without posting | ❌ No `POST /api/v1/orders` endpoint | Needs new `POST /api/v1/orders` endpoint + wire mobile |
| `order_success_screen.dart` | Order confirmation data (orderId, clinic, doctor, delivery estimate) | **Hardcoded fallbacks** — `PED-2042`, "Clínica Santa Mônica", "Dra. Mariana Silva", "25 a 29 de abril de 2026" | ❌ No create-order response consumed | Wire to response from `POST /api/v1/orders` once created |
| `product_order_sheet.dart` | Price suggestions (negotiated price, discount badges, price history) | **Mock function** — `getSuggestedPrice()` from `legacy_orders_mock.dart` | ❌ No price suggestion endpoint | Needs new `GET /api/v1/products/:id/price-suggestion?clinicId=...` endpoint |
| `orders_provider.dart` | Cart provider types | **Imports mock types** — `SelectableClinic`, `SelectableDoctor` from `legacy_orders_mock.dart` | ❌ | Replace with real models from checkout API |

#### Central mock file:

| File | Data | Current source | API available? | Recommendation |
|---|---|---|---|---|
| `legacy_orders_mock.dart` | 7 products, 5 orders, 2 tracking orders, 5 clinics, 7 doctors, price suggestion function | All hardcoded constants and maps | N/A (mock file) | Remove when all consumers are migrated to real API |

---

### Presentations — 🚧 Placeholder Stub

| Screen | Data | Current source | API available? | Recommendation |
|---|---|---|---|---|
| `presentations_screen.dart` | Entire screen is hardcoded "Em breve" stub | Inline string literals, color constants, icon | No presentations endpoint exists | Design and implement presentations API + wire mobile |

---

### Profile — ✅ Fully Real API

| Screen | Data | Current source | API available? | Recommendation |
|---|---|---|---|---|
| `profile_screen.dart` | User info, territory stats, quick summary, preferences | `currentUserProvider`, `TerritoryStatsProvider`, `QuickSummaryProvider`, `PreferencesProvider` — all real API-backed | ✅ | None needed. Dead `activity.dart` and `support.dart` models should be cleaned up. |
| `profile_screen.dart` | Region fallback text | Hardcoded string `'Sem território definido'` when no territory assigned | ✅ Acceptable UI fallback | None needed (territory may genuinely be unassigned) |

**Note:** Support & account settings section was intentionally removed (lines 602–603 comment) pending real API endpoints for those features. The model files `activity.dart` and `support.dart` are unused dead code.

---

### Visits — ✅ Fully Real API (No Screens Yet)

| Provider | Data | Current source | API available? | Recommendation |
|---|---|---|---|---|
| `visit_summary_provider.dart` | Weekly visit summary | `VisitRepository.getWeeklySummary()` → `GET /api/v1/visits/weekly-summary` | ✅ | None needed for data; screens need to be built |

**Note:** `POST /api/v1/visits` (record visit) exists in the API but is not consumed by any mobile screen — the mobile visits feature has no UI screens yet.

---

## Full Flagged Items Table

| Screen | Data | Current source | API available? | Recommendation |
|---|---|---|---|---|
| `orders/checkout_screen.dart` | Clinic selector list | `kSelectorClinics` (mock list in `legacy_orders_mock.dart`) | ❌ | Create `GET /api/v1/checkout/clinics` endpoint + replace with real repo |
| `orders/checkout_screen.dart` | Doctor selector list | `kSelectorDoctors` (mock list in `legacy_orders_mock.dart`) | ❌ | Create `GET /api/v1/checkout/doctors` endpoint + replace with real repo |
| `orders/checkout_screen.dart` | Order submission | No API call; navigates to success screen | ❌ No `POST /api/v1/orders` | Create `POST /api/v1/orders` endpoint + wire mobile |
| `orders/order_tracking_screen.dart` | Full tracking detail (items, driver, timeline, pricing) | `kTrackingOrders` (mock map) | ❌ No tracking endpoint | Create `GET /api/v1/orders/:id/tracking` + wire mobile |
| `orders/order_success_screen.dart` | Order ID, clinic/doctor name, delivery estimate | Hardcoded string fallbacks: `PED-2042`, "Clínica Santa Mônica", "Dra. Mariana Silva" | ❌ | Wire to `POST /api/v1/orders` response data |
| `orders/product_order_sheet.dart` | Price suggestion data | `getSuggestedPrice()` mock function | ❌ | Create `GET /api/v1/products/:id/price-suggestion` endpoint |
| `orders/orders_provider.dart` | Cart clinic/doctor types | Imports `SelectableClinic`, `SelectableDoctor` from mock file | ❌ | Replace with real models from API |
| `orders/data/repositories/legacy_orders_mock.dart` | All mock products, orders, clinics, doctors, price logic | Fully hardcoded constants | N/A | Delete after migration complete |
| `dashboard/dashboard_screen.dart` | Entire screen | Hardcoded "Em breve" stub string | ❌ | Design dashboard feature; create API + wire |
| `presentations/presentations_screen.dart` | Entire screen | Hardcoded "Em breve" stub string | ❌ | Design presentations feature; create API + wire |
| `profile/data/models/activity.dart` | RecentActivity model | Unused dead code | N/A | Remove if not planned; or wire to API |
| `profile/data/models/support.dart` | SupportItem model | Unused dead code | N/A | Remove if not planned; or wire to API when support endpoints exist |

---

## API Endpoint Gaps Summary

| Missing endpoint | Needed by | Priority |
|---|---|---|
| `POST /api/v1/orders` (create order) | `checkout_screen.dart` | **High** — blocks checkout flow |
| `GET /api/v1/orders/:id/tracking` | `order_tracking_screen.dart` | **High** — currently fully mock |
| `GET /api/v1/products/:id/price-suggestion` | `product_order_sheet.dart` | **High** — currently fully mock |
| `GET /api/v1/checkout/clinics` (or similar) | `checkout_screen.dart` | **High** — currently mock list |
| `GET /api/v1/checkout/doctors` (or similar) | `checkout_screen.dart` | **High** — currently mock list |
| Dashboard endpoints | `dashboard_screen.dart` | **Low** — stub placeholder |
| Presentations endpoints | `presentations_screen.dart` | **Low** — stub placeholder |
| Align `POST /auth/forgot-password` → `/api/v1/password-reset/request` | `forgot_email_screen.dart` | **Medium** — works but wrong path |
| Align `POST /auth/reset-password` → `/api/v1/password-reset/confirm` | `forgot_new_password_screen.dart` | **Medium** — works but wrong path |

---

## Key Findings

1. **Orders is the only feature with mock data.** The legacy mock file `legacy_orders_mock.dart` is the single source, imported by 4 files. Order listing/detail/catalog already use the real API.

2. **4 screens/widgets still consume mock data:** `order_tracking_screen.dart`, `checkout_screen.dart`, `order_success_screen.dart`, and `product_order_sheet.dart`. None have corresponding API endpoints yet.

3. **No `POST /api/v1/orders` endpoint exists.** The API only exposes `GET /api/v1/orders` (list) and `GET /api/v1/orders/:id` (detail). Checkout cannot submit orders.

4. **Dashboard and Presentations are pure stubs.** They contain no data layer whatsoever — just "Em breve" placeholder text.

5. **Auth password-reset routes are mismatched.** Mobile calls `/auth/forgot-password`, `/auth/verify-reset-code`, `/auth/reset-password` but the API exposes `/api/v1/password-reset/request` and `/api/v1/password-reset/confirm`. A verification-code endpoint is entirely missing from the API.

6. **The visits feature has real API wiring but no screens.** `POST /api/v1/visits` (record visit) exists server-side but no mobile screen calls it.

7. **Dead models `activity.dart` and `support.dart`** exist in the profile feature but are not imported anywhere. They should be removed or wired to future API endpoints.

8. **Data mapping gaps** in the Explore `fromApi()` mappers default several fields (`neighborhood`, `status`, `lastVisitDays`, `isPriority`, `products`, `initials`, `hue`, `primaryClinic`) to empty/zero because the paginated API responses don't include them. These are API completeness gaps, not mock data.
