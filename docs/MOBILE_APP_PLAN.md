# Riderguy Mobile Apps — Comprehensive Build Plan
> iOS + Android for both Customer and Rider apps using Expo + React Native

---

## Overview

| App | Store Name | Users | Listings |
|---|---|---|---|
| `apps/client-native` | "RiderGuy – Send Packages" | Customers | App Store + Play Store |
| `apps/rider-native` | "RiderGuy Rider" | Riders | App Store + Play Store |

**4 store listings. 2 Expo codebases. 1 existing backend — zero API changes.**

---

## Important: Building for iOS Without a Mac

Running macOS on non-Apple hardware (Hetzner or local PC VM) violates Apple's EULA. The correct solution is **EAS Build** — Expo's cloud build service runs on real Apple Mac Mini machines. The Production plan (~$99/month) is far simpler and cheaper than maintaining a Hackintosh server. The Hetzner server stays focused on the API only.

---

## Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | Expo SDK 52 + Expo Router v4 | File-based routing mirrors the existing Next.js App Router pattern |
| Styling | NativeWind v4 | Same Tailwind class names the team already knows |
| Maps | `react-native-maps` (Google Maps provider) | Same Google Maps API key, same backend directions endpoint |
| Location | `expo-location` + `expo-task-manager` | Foreground + background GPS for rider app |
| Push notifications | `expo-notifications` + `@react-native-firebase/messaging` | Reuses existing Firebase project + FCM infrastructure |
| Token storage | `expo-secure-store` | Encrypted keychain (iOS) + EncryptedSharedPrefs (Android) |
| Biometric auth | `expo-local-authentication` | Replaces WebAuthn browser API |
| Camera | `expo-image-picker` + `expo-camera` | Proof of delivery, KYC document upload |
| Real-time | `socket.io-client` | Exact same package — no changes to socket events |
| Server state | TanStack React Query v5 | Same package, same query keys as web |
| Local state | Zustand | Same package as web |
| Validation | Zod via `@riderguy/validators` | 100% reusable — no changes |
| Navigation | Expo Router v4 | Stack + Tab navigators |
| Animations | React Native Reanimated v3 | Job offer countdown, XP level-up animations |
| Build | EAS Build | Cloud Mac builders for iOS, Linux for Android |
| Payments | `expo-web-browser` | Opens Paystack checkout in a secure in-app browser |
| Keep-awake | `expo-keep-awake` | Replaces web `useWakeLock` for rider screen |
| Audio (iOS) | `expo-av` | Background audio keep-alive to prevent iOS socket suspension |
| Bottom sheets | `@gorhom/bottom-sheet` | Order info panels, withdrawal modal |
| Toasts | `react-native-toast-message` | Replaces web toast system |

---

## Shared Package Reusability

| Package | Reusable? | Action |
|---|---|---|
| `@riderguy/types` | 100% | Import as-is — all TypeScript interfaces are platform-agnostic |
| `@riderguy/utils` | 100% | Import as-is — all pure functions (geo, format, date, constants) |
| `@riderguy/validators` | 100% | Import as-is — Zod works in React Native |
| `@riderguy/auth` | ~60% | Create `packages/auth-native` — keep Zustand store + Axios client, replace `localStorage` with `expo-secure-store`, replace WebAuthn with `expo-local-authentication`, remove React web components |
| `@riderguy/config` | 0% | Web-only (Tailwind config). Replace with Expo `app.config.ts` |
| `@riderguy/ui` | 0% | Web-only (Radix UI). Build new native component library |
| `@riderguy/database` | 0% | Server-only (Prisma). Never import in React Native |

**New package to create: `packages/auth-native`**

---

## Monorepo Structure After Build

```
riderguy/
├── apps/
│   ├── api/                    (existing — no changes)
│   ├── client/                 (existing web PWA — no changes)
│   ├── rider/                  (existing web PWA — no changes)
│   ├── admin/                  (existing — no changes)
│   ├── marketing/              (existing — no changes)
│   ├── client-native/          ← NEW: Expo customer app
│   └── rider-native/           ← NEW: Expo rider app
├── packages/
│   ├── types/                  (existing — reused as-is)
│   ├── utils/                  (existing — reused as-is)
│   ├── validators/             (existing — reused as-is)
│   ├── auth/                   (existing — web only, untouched)
│   ├── auth-native/            ← NEW: React Native auth port
│   ├── ui/                     (existing — web only, untouched)
│   └── config/                 (existing — web only, untouched)
```

---

## Navigation Architecture

### Client App (`apps/client-native`)

```
app/
├── (auth)/
│   ├── _layout.tsx             Stack navigator, no tab bar
│   ├── index.tsx               Landing / get started
│   ├── login.tsx               Phone input + method selector
│   ├── register.tsx            Phone OTP → name → PIN setup
│   ├── forgot-password.tsx
│   └── forgot-pin.tsx
├── (tabs)/                     Bottom tab bar — 4 tabs
│   ├── _layout.tsx
│   ├── index.tsx               Dashboard home
│   ├── orders.tsx              Order history
│   ├── wallet.tsx              Wallet + transactions
│   └── account.tsx             Settings hub
└── (app)/                      Stack screens (no tab bar)
    ├── quick-send.tsx          4-step send package flow
    ├── orders/
    │   ├── [id].tsx            Order detail
    │   ├── [id]/tracking.tsx   Live map tracking
    │   ├── [id]/rate.tsx       Star rating + feedback
    │   └── [id]/payment.tsx    Payment confirmation
    ├── wallet/
    │   └── add-funds.tsx       Paystack top-up (in-app browser)
    ├── notifications.tsx
    ├── saved-addresses.tsx
    ├── favorite-riders.tsx
    ├── promos.tsx
    ├── safety-center.tsx
    ├── chat/[orderId].tsx
    └── settings/
        ├── profile.tsx
        ├── payment-methods.tsx
        ├── notifications.tsx
        ├── security/set-pin.tsx
        ├── security/change-pin.tsx
        ├── help.tsx
        └── about.tsx
```

### Rider App (`apps/rider-native`)

```
app/
├── (auth)/
│   ├── _layout.tsx
│   ├── index.tsx               Login
│   ├── login.tsx
│   ├── register.tsx
│   └── onboarding/
│       ├── index.tsx           Onboarding progress overview
│       ├── documents.tsx       ID + license upload (camera)
│       ├── selfie.tsx          Liveness check photo
│       ├── vehicle.tsx         Vehicle registration details
│       └── vehicle-photos.tsx  Exterior + interior photos
├── (tabs)/                     Bottom tab bar — 5 tabs
│   ├── _layout.tsx
│   ├── index.tsx               Rider dashboard home
│   ├── jobs.tsx                Available + active jobs
│   ├── earnings.tsx            Wallet + withdrawals
│   ├── community.tsx           Chat + forum hub
│   └── account.tsx             Profile + settings
└── (app)/                      Stack screens
    ├── jobs/
    │   └── [id].tsx            Job detail + navigation map
    ├── gamification.tsx        XP, badges, leaderboard
    ├── training.tsx            Learning center
    ├── cancellations.tsx       Cancelled order history
    ├── notifications.tsx
    ├── community/
    │   ├── chat/[roomId].tsx   Real-time chat room
    │   ├── forum/[postId].tsx  Forum thread
    │   ├── mentorship/[id].tsx Mentorship session
    │   └── events/[id].tsx     Community event
    └── settings/
        ├── profile.tsx
        ├── security/set-pin.tsx
        ├── security/change-pin.tsx
        └── about.tsx
```

---

## Phase-by-Phase Build Plan

### Phase 0 — Accounts & Prerequisites (Days 1–5)

1. **Apple Developer Program** — enroll at developer.apple.com ($99/year, approval takes 24–48h)
2. **Google Play Console** — create account at play.google.com/console ($25 one-time fee)
3. **EAS Account** — create at expo.dev (free to start, upgrade to Production plan before submission)
4. **Bundle IDs** — register in Apple Developer portal:
   - `com.riderguy.client`
   - `com.riderguy.rider`
5. **Firebase** — add iOS and Android apps to the existing Firebase project. Download:
   - `GoogleService-Info.plist` (iOS, one per app)
   - `google-services.json` (Android, one per app)
6. **Google Maps** — create new API key restricted to the two iOS bundle IDs and two Android package names (separate from the web key)

---

### Phase 1 — Monorepo Setup (Days 5–10)

**1.1 Create `apps/client-native`**
```bash
cd apps && npx create-expo-app client-native --template expo-router
```

Configure:
- `app.config.ts` with name, slug, bundle IDs, permissions
- `eas.json` — 3 build profiles: `development`, `preview`, `production`
- NativeWind v4 + Tailwind config
- `tsconfig.json` extending `../../tsconfig.base.json`
- Turbo pipeline entry

**1.2 Create `apps/rider-native`**
Same process with rider-specific config.

**1.3 Update `turbo.json`**
Add `client-native` and `rider-native` to the build pipeline. Configure `transpilePackages` for all `@riderguy/*` packages.

**1.4 Configure `metro.config.js`**
Metro needs to resolve packages from the workspace root `node_modules` as well as app-level. Required for monorepo support.

**1.5 EAS Setup**
```bash
eas build:configure   # generates eas.json
eas credentials       # sets up iOS certificates + provisioning profiles
```

**`eas.json`**
```json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./play-store-key.json",
        "track": "internal"
      }
    }
  }
}
```

---

### Phase 2 — `packages/auth-native` (Days 10–15)

The foundational package. Everything depends on auth working.

**Contents:**

| File | Source | Action |
|---|---|---|
| `token-storage.ts` | `@riderguy/auth` | Rewrite — same interface, backed by `expo-secure-store` |
| `api-client.ts` | `@riderguy/auth` | Copy unchanged — Axios + token refresh works in React Native |
| `auth-store.ts` | `@riderguy/auth` | Copy unchanged — Zustand is cross-platform |
| `biometric.ts` | `@riderguy/auth` | Rewrite — replace `@simplewebauthn/browser` with `expo-local-authentication` |
| `AuthProvider.tsx` | New | React Native context (no `ProtectedRoute`, use Expo Router auth guard instead) |
| `use-auth.ts` | `@riderguy/auth` | Copy unchanged — same hook interface |

**Biometric implementation (native vs web):**
- Web: registers a passkey via WebAuthn ceremony with the server
- Native: biometric unlocks locally stored token — `expo-local-authentication` gates retrieval of the JWT from `expo-secure-store`
- Server sees no difference — it validates the JWT the same way regardless

**Token storage:**
```typescript
// packages/auth-native/src/token-storage.ts
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'riderguy_access_token';
const REFRESH_KEY = 'riderguy_refresh_token';

export const tokenStorage = {
  getAccessToken: () => SecureStore.getItemAsync(ACCESS_KEY),
  setAccessToken: (token: string) => SecureStore.setItemAsync(ACCESS_KEY, token),
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_KEY),
  setRefreshToken: (token: string) => SecureStore.setItemAsync(REFRESH_KEY, token),
  clearTokens: async () => {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};
```

---

### Phase 3 — Shared Infrastructure (Days 15–25)

Both apps share these patterns. Build once, apply to both.

**3.1 API Client**
- `initApiClient(baseURL)` from `packages/auth-native`
- Axios interceptor: 401 → refresh token → retry original request
- All existing backend endpoints work unchanged

**3.2 React Query Setup**
- Same `QueryClient` config as the web apps
- Same query keys (`['orders']`, `['wallet']`, `['notifications-unread-count']`, etc.)

**3.3 Socket.io Hook (port of web `use-socket.ts`)**
- `socket.io-client` works in React Native unchanged
- Same singleton pattern and reference counting
- Replace `document.addEventListener('visibilitychange', ...)` with `AppState.addEventListener('change', ...)` (React Native equivalent)
- Same events: `order:subscribe`, `rider:updateLocation`, `job:offer`, `message:send`, etc.

**3.4 Push Notifications**

Install: `@react-native-firebase/app` + `@react-native-firebase/messaging`

Place files:
- `GoogleService-Info.plist` → `apps/client-native/ios/` and `apps/rider-native/ios/`
- `google-services.json` → `apps/client-native/android/app/` and `apps/rider-native/android/app/`

Port `use-push-notifications.ts`:
```typescript
// Request permission
await messaging().requestPermission();

// Get FCM token
const token = await messaging().getToken();

// Register with existing backend endpoint (platform changes to 'ios' or 'android')
await api.post('/users/push-token', { token, platform: Platform.OS, deviceId });

// Foreground messages
messaging().onMessage(async remoteMessage => {
  // Show notification + invalidate React Query
});

// Background/quit messages (auto-handled by Firebase SDK)
messaging().setBackgroundMessageHandler(async remoteMessage => { });

// Notification tap → navigate to correct screen
messaging().onNotificationOpenedApp(remoteMessage => { /* navigate */ });
```

**3.5 Google Maps**
- Install `react-native-maps` with Google Maps provider
- iOS config in `app.config.ts`: `googleMapsApiKey` under `ios`
- Android config in `app.config.ts`: API key injected into `AndroidManifest.xml` via plugin
- Create `<MapView>` wrapper components that mirror the web `client-map.tsx` and `tracking-map.tsx` patterns

**3.6 Native UI Component Library**

Build in both apps under `src/components/ui/`:

| Component | Replaces | Notes |
|---|---|---|
| `Button` | `@riderguy/ui` Button | primary, secondary, ghost variants |
| `Input` | `@riderguy/ui` Input | label + error display |
| `PhoneInput` | `@riderguy/ui` PhoneInput | country code + number, Ghana +233 default |
| `OtpInput` | `@riderguy/ui` OtpInput | 6-box animated entry, auto-advance |
| `Card` | `@riderguy/ui` Card | container with border/shadow |
| `Badge` | `@riderguy/ui` Badge | status labels with color coding |
| `Avatar` | `@riderguy/ui` Avatar | profile image with initials fallback |
| `Spinner` | `@riderguy/ui` Spinner | loading indicator |
| `Skeleton` | `@riderguy/ui` Skeleton | shimmer loading placeholder |
| `BottomSheet` | Web modal | via `@gorhom/bottom-sheet` |
| `Toast` | Web toast | via `react-native-toast-message` |
| `StatusBar` | Web none | handles iOS/Android color sync |

---

### Phase 4 — Client App: Auth (Days 25–32)

**Login Screen** (`(auth)/login.tsx`)
- Ghana phone number input (with +233 prefix, formatted)
- "Continue" → calls `GET /auth/check-methods?phone=...` → determines available login methods
- Shows method selector bottom sheet: PIN pad / biometric button / OTP SMS
- "Sign in with Google" via `expo-auth-session`

**OTP Screen**
- 6-box animated OTP input
- 60-second resend countdown
- Auto-submit on last digit

**PIN Screen**
- 6-dot display, numeric keypad
- Biometric button (if `expo-local-authentication` reports enrolled + hardware available)

**Register Screen** (`(auth)/register.tsx`)
- Phone number → Send OTP → Enter OTP → First + Last name → Set 6-digit PIN → Done
- Same field validation via `@riderguy/validators` (phoneSchema, passwordSchema, etc.)

**Forgot Password / Forgot PIN**
- Phone → OTP verification → new password/PIN input

**Auth Guard (`app/_layout.tsx`)**
```typescript
// Expo Router root layout
const { isAuthenticated, isLoading } = useAuth();

useEffect(() => {
  if (!isLoading && !isAuthenticated) {
    router.replace('/(auth)/login');
  }
}, [isAuthenticated, isLoading]);
```

---

### Phase 5 — Client App: Core Features (Days 32–50)

**5.1 Dashboard Home (`(tabs)/index.tsx`)**

Maps directly to web `/dashboard/page.tsx`:
- Sticky header: logo + notifications bell with unread count badge + profile avatar
- Hero banner: "Send a Package" CTA
- 2-button service grid: Quick Delivery (green) + Book a Ride (blue)
- 4×2 utility grid: Schedule, Track, Saved Addresses, Rider Wizard, Refer & Earn, Safety, Help, Settings
- Recent orders: 3 cards with status badges
- Data: `useQuery(['recent-orders'])` + `useQuery(['notifications-unread-count'])`
- Safe area insets via `useSafeAreaInsets()` from `react-native-safe-area-context`

**5.2 Quick Send (`(app)/quick-send.tsx`)**

4-step flow (mirrors web `/dashboard/quick-send`):

*Step 1 — Locations:*
- Current location: `expo-location.requestForegroundPermissionsAsync()` → `getCurrentPositionAsync()`
- Dropoff: text input → debounced autocomplete → calls `/places/autocomplete` backend endpoint
- Map picker modal: `react-native-maps` with tap-to-select + reverse geocode via backend

*Step 2 — Package & Schedule:*
- Package type selector (horizontal `FlatList` with icons)
- Schedule type selector: NOW / SAME_DAY / NEXT_DAY / RECURRING
- Recipient name field (optional)

*Step 3 — Price & Availability:*
- `PriceBreakdown` card
- `react-native-maps` showing nearby riders (polling `/riders/nearby` every 15s)
- Quantity picker

*Step 4 — Confirmation:*
- Summary card (pickup, dropoff, package type, estimated price)
- Payment method selector (wallet or new payment)
- Submit → `POST /orders` → navigate to order detail

**5.3 Order History (`(tabs)/orders.tsx`)**
- `FlatList` of orders with status badges
- Pull-to-refresh (`onRefresh` + `refreshing`)
- Tap → navigate to `(app)/orders/[id]`

**5.4 Order Detail (`(app)/orders/[id].tsx`)**
- Pickup / dropoff addresses
- Rider info card (name, rating, vehicle, photo)
- Order timeline / progress bar
- "Track Order" button (if active) → navigates to tracking screen

**5.5 Live Tracking (`(app)/orders/[id]/tracking.tsx`)**
- Full-screen `react-native-maps`
- Pickup marker (green pin), dropoff marker (red pin), rider marker (with heading rotation via `Animated`)
- Polyline route from backend `/orders/directions`
- Socket.io: `order:subscribe` → listen `rider:location` → update rider marker position
- ETA display (updates as rider moves)
- Cancel order button (if status allows)
- Chat button → `(app)/chat/[orderId]`

**5.6 Rating (`(app)/orders/[id]/rate.tsx`)**
- 5-star selector (Reanimated scale animation on tap)
- Text feedback field
- Submit → `POST /orders/:id/rate`

**5.7 Wallet (`(tabs)/wallet.tsx`)**
- Balance card with show/hide eye toggle
- "Add Funds" button → `expo-web-browser.openBrowserAsync(paystackUrl)` (in-app browser, returns automatically)
- Transaction history in `SectionList` grouped by date (Today, Yesterday, Month Name)
- Transaction rows: type icon, description, amount (green for credit, red for debit)
- Data: `useQuery(['wallet'])` + `useQuery(['wallet-transactions'])`

**5.8 Notifications (`(app)/notifications.tsx`)**
- `FlatList` of notifications, unread items highlighted
- Tap marks as read via `PATCH /notifications/:id`

**5.9 Settings Screens**
- Profile edit: name fields + avatar upload via `expo-image-picker`
- Saved addresses: list + add/remove
- Notification preferences: toggle switches per category
- PIN setup / change: 6-dot numeric pad (2-step: enter new PIN → confirm)
- Help: FAQ accordion
- About: version, terms URL, privacy URL

---

### Phase 6 — Rider App: Auth & Dashboard (Days 50–62)

**6.1 Rider Auth**
Same as client auth but with `UserRole.RIDER` check. After login, check `onboardingStatus` from `/riders/me` — if not `ACTIVATED`, redirect to `(auth)/onboarding`.

**6.2 Rider Onboarding (KYC Flow)**

Cannot go ONLINE until all steps are `APPROVED`. Each step shows status badge.

*Documents (`(auth)/onboarding/documents.tsx`):*
- Upload National ID + Driver's License
- `expo-image-picker` for gallery or `expo-camera` for capture
- Upload via `POST /documents` (multipart/form-data)
- Status: Pending → Under Review → Approved / Rejected

*Selfie (`(auth)/onboarding/selfie.tsx`):*
- `expo-camera` front-facing with instruction overlay
- Single capture → upload

*Vehicle Details (`(auth)/onboarding/vehicle.tsx`):*
- Registration number, vehicle type (dropdown), year, make, model
- Submit via `POST /riders/vehicle`

*Vehicle Photos (`(auth)/onboarding/vehicle-photos.tsx`):*
- 4 photos: exterior front, exterior rear, exterior side, interior
- Grid picker, each slot shows captured image or "+" placeholder
- All 4 required before submission

**6.3 Rider Dashboard Home (`(tabs)/index.tsx`)**

The most complex screen — mirrors web rider dashboard (~760 lines):

*Structure:*
1. **Sticky Header** — menu button, RiderGuy logo, notifications bell with badge
2. **Greeting Hero** — "Good Morning/Afternoon/Evening, [Name]" + online/offline status pill
3. **System Alert Banners** (conditional, stacked):
   - GPS error (red)
   - Socket reconnecting (amber + spinner)
   - Socket disconnected (red)
   - Poor network quality (amber)
   - No network (red)
   - Onboarding incomplete (amber, links to onboarding)
4. **Wallet Card** — green gradient, balance (show/hide), Add Money / Cash Out / History buttons
5. **Today's Stats** — deliveries count, total earnings, rating + star
6. **Go Online Toggle** — animated radio icon, starts GPS tracking
7. **Active Deliveries** — list of in-progress orders (if any)
8. **Recommended** — Refer & Earn, Learning Center, Community cards
9. **Gamification Card** — level badge, level name, XP progress bar

*Hooks wired up:*
- `useRiderAvailability()` — GPS tracking + online/offline toggle
- `useSocket()` — socket connection state + job offer listener
- `useConnectionHealth()` — network quality monitoring
- `expo-keep-awake.activateKeepAwakeAsync()` — screen stays on while online
- `expo-av` background audio — iOS socket keep-alive
- `usePushNotifications()` — FCM setup on mount
- `AppState.addEventListener('change', ...)` — foreground recovery (replaces web `useVisibility`)

---

### Phase 7 — Rider App: GPS & Online System (Days 62–72)

This is the most native-critical part of the project and the biggest win over the PWA.

**7.1 Foreground GPS (`hooks/use-rider-availability.ts`)**

Port from web with native APIs:
```typescript
// Start watching position
const subscription = await Location.watchPositionAsync(
  { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
  (location) => {
    const { latitude, longitude, heading, speed } = location.coords;
    // Apply same debounce logic as web:
    // - Skip if < 30m moved AND heading change < 25° AND < 30s elapsed
    // - Otherwise emit via socket AND REST heartbeat
    socket.emit('rider:updateLocation', { latitude, longitude, heading });
  }
);

// Adaptive accuracy: switch to Balanced after 2min stationary to save battery
```

**7.2 Background GPS (The Key Native Advantage)**

Riders must share location even when the phone is locked or another app is in front.

```typescript
// Define the background task (runs even when app is suspended)
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  const { locations } = data as { locations: Location.LocationObject[] };
  const latest = locations[locations.length - 1];
  // POST to /riders/location (REST, not socket — socket may be suspended)
  await fetch(`${API_URL}/riders/location`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ latitude: latest.coords.latitude, longitude: latest.coords.longitude })
  });
});

// Start when rider goes ONLINE
await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 10000,        // Every 10 seconds
  distanceInterval: 30,       // Or every 30 meters — whichever comes first
  foregroundService: {        // Android ONLY: shows persistent notification in status bar
    notificationTitle: "RiderGuy — You're Online",
    notificationBody: "Your location is being shared with customers",
    notificationColor: "#22c55e"
  },
  pausesUpdatesAutomatically: false,  // iOS: do not pause updates automatically
  activityType: Location.ActivityType.AutomotiveDrivecourse,
});

// Stop when rider goes OFFLINE
await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
```

**iOS requirements:**
- `UIBackgroundModes: ["location"]` in `Info.plist` (set via `app.config.ts`)
- `NSLocationAlwaysAndWhenInUseUsageDescription` usage string

**Android requirements:**
- `ACCESS_BACKGROUND_LOCATION` permission (prompted separately from fine location)
- `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION` permissions

**7.3 Socket Keep-Alive (iOS)**

iOS suspends apps in background after ~30 seconds unless:
1. Background Location task is running (primary — keeps process alive while online)
2. `expo-av` plays silent audio (secondary fallback — same as web `useAudioKeepAlive`)

**7.4 Screen Wake Lock**
```typescript
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

// On go online
await activateKeepAwakeAsync();

// On go offline
deactivateKeepAwake();
```

---

### Phase 8 — Rider App: Jobs & Dispatch (Days 72–85)

**8.1 Jobs Tab (`(tabs)/jobs.tsx`)**
- Segmented control (Reanimated sliding pill): Available | Active
- Available jobs: `FlatList` polling `/orders/available` + socket `job:new` triggers refetch
- Active jobs: `FlatList` of in-progress deliveries
- Job card: earnings (large, prominent), package type icon, route (pickup → dropoff), distance, time posted
- Pull-to-refresh on both tabs

**8.2 Incoming Job Offer Modal**

The most time-sensitive screen in the project — wired to the dispatch engine:

```
┌─────────────────────────────────────────┐
│         New Delivery Request            │
│                                         │
│    ┌───────────────────────────────┐    │
│    │  ◯ 28s remaining             │    │  ← Animated SVG countdown ring
│    └───────────────────────────────┘    │
│                                         │
│         GH₵ 42.50                       │  ← Earnings, large + prominent
│       Est. earnings                     │
│                                         │
│  📦 Document · 3.2 km · ~18 min        │
│                                         │
│  From: 15 Liberation Road, Accra        │
│  To:   Kotoka Airport, Terminal 3       │
│                                         │
│  [  Decline  ]      [  Accept  ]        │
└─────────────────────────────────────────┘
```

- Full-screen overlay (Modal component covering tab bar)
- Circular countdown: `Animated.Value` driving `strokeDashoffset` on SVG circle
- Audio: `expo-av` plays `job_offer.mp3` on appear (with volume check)
- Haptic: `expo-haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)` on appear
- Body scroll lock: not applicable in native (handled automatically)
- Android back button: intercept with `BackHandler.addEventListener`
- On Accept: emit `job:offer:respond { orderId, response: 'accept' }` with ACK callback
- On Decline: emit `job:offer:respond { orderId, response: 'decline' }`, dismiss
- On Expire: socket `job:offer:expired` → dismiss with expiry message
- Dedup guard: 12-second window prevents double-accept for same `orderId`

**Triggers for this modal:**
1. Socket `job:offer` event when app is in foreground
2. Push notification tap when app is background/killed → app opens → navigate to modal

**8.3 Job Detail (`(app)/jobs/[id].tsx`)**

- Full-screen `react-native-maps` with route polyline
- Bottom sheet (`@gorhom/bottom-sheet`) for order info (collapsible, 3 snap points)
- Status progression button (changes based on current status):

| Current Status | Button Label | Action |
|---|---|---|
| ASSIGNED | Start Navigation | Open Google Maps deep link + `PATCH /orders/:id {status: EN_ROUTE_TO_PICKUP}` |
| EN_ROUTE_TO_PICKUP | I've Arrived at Pickup | `PATCH /orders/:id {status: AT_PICKUP}` |
| AT_PICKUP | Package Collected | `PATCH /orders/:id {status: EN_ROUTE_TO_DROPOFF}` |
| EN_ROUTE_TO_DROPOFF | I've Arrived at Dropoff | `PATCH /orders/:id {status: AT_DROPOFF}` |
| AT_DROPOFF | Complete Delivery | → Proof of Delivery flow |

- Real-time GPS emitting while screen is active (foreground location)
- Chat bottom sheet (socket `message:send` / `message:receive`)
- Cancel order button (opens reason picker)

**8.4 Google Maps Deep Link for Navigation**
```typescript
const openNavigation = async (latitude: number, longitude: number) => {
  const googleMapsUrl = Platform.select({
    ios: `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`,
    android: `google.navigation:q=${latitude},${longitude}`
  });
  const appleMapsUrl = `maps://app?daddr=${latitude},${longitude}`;
  const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  const canOpenGoogle = await Linking.canOpenURL(googleMapsUrl!);
  if (canOpenGoogle) {
    await Linking.openURL(googleMapsUrl!);
  } else if (Platform.OS === 'ios') {
    await Linking.openURL(appleMapsUrl);  // Apple Maps fallback on iOS
  } else {
    await Linking.openURL(webFallback);   // Browser fallback
  }
};
```

**8.5 Proof of Delivery**
- `expo-image-picker` (camera or gallery)
- Image compression: `expo-image-manipulator` (resize to max 1200px, JPEG quality 0.8)
- Upload with progress: `axios.post('/orders/:id/complete', formData, { onUploadProgress })`
- Progress bar component with percentage display

---

### Phase 9 — Rider App: Earnings & Advanced Features (Days 85–100)

**9.1 Earnings (`(tabs)/earnings.tsx`)**

- Wallet card: animated green gradient, available balance, total earned subtitle
- Stats row: total earnings, total withdrawn
- Transaction history: `SectionList` grouped by date
- Withdrawal modal (multi-step `BottomSheet`):
  1. Choose method: Mobile Money | Bank Transfer
  2. Provider dropdown + account number + "Verify" button → `POST /payments/resolve-account`
  3. Confirmed account name + amount input + preset buttons (GH₵50 / 100 / 200 / All)
  4. Confirm screen → `POST /wallets/withdraw`
  5. Success screen with checkmark animation

**9.2 Gamification (`(app)/gamification.tsx`)**
- Level badge with gradient background
- Level name + XP count
- Animated progress bar (Reanimated `withTiming`)
- Badge grid: earned badges (full color) + locked badges (greyed out)
- Leaderboard tabs: Daily / Weekly / Monthly / All-time
- Level-up celebration: confetti animation + badge notification on XP milestone

**9.3 Community (`(tabs)/community.tsx`)**

Tabbed hub:
- Chat Rooms: list of rooms, unread count badge, tap → chat screen
- Forum: post list with upvote count, tap → thread view
- Events: upcoming events with RSVP button
- Mentorship: find/message mentors

Chat Room (`(app)/community/chat/[roomId].tsx`):
- `FlatList` of messages (inverted for bottom-to-top reading)
- Socket: `community:join`, `community:send`, `community:typing`, listen `community:message`
- Typing indicator (animated dots)
- Input bar with send button

**9.4 Training (`(app)/training.tsx`)**
- Learning materials list (safety guides, skill videos)
- Video content via `expo-video` or `WebView` for embedded content

**9.5 Cancellations (`(app)/cancellations.tsx`)**
- History list of cancelled orders
- Each row: date, reason, order number

**9.6 Rider Settings**
- Profile edit: name, phone, avatar (`expo-image-picker`)
- PIN setup / change
- Notifications preferences
- About / version

---

### Phase 10 — App Config, Permissions & Native Setup (Days 100–110)

**`app.config.ts` — Client App**
```typescript
export default {
  name: "RiderGuy",
  slug: "riderguy-client",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  splash: { image: "./assets/splash.png", backgroundColor: "#22c55e" },
  ios: {
    bundleIdentifier: "com.riderguy.client",
    supportsTablet: false,
    googleServicesFile: "./GoogleService-Info.plist",
    infoPlist: {
      NSLocationWhenInUseUsageDescription: "To detect your pickup location automatically",
      NSCameraUsageDescription: "To upload your profile photo",
      NSPhotoLibraryUsageDescription: "To select a profile photo from your gallery",
      NSFaceIDUsageDescription: "To log in quickly and securely with Face ID"
    }
  },
  android: {
    package: "com.riderguy.client",
    googleServicesFile: "./google-services.json",
    permissions: ["ACCESS_FINE_LOCATION", "CAMERA", "READ_MEDIA_IMAGES"]
  },
  plugins: [
    ["expo-location", { locationWhenInUsePermission: "..." }],
    ["expo-camera", { cameraPermission: "..." }],
    "@react-native-firebase/app",
    "expo-secure-store",
    "expo-local-authentication"
  ]
};
```

**`app.config.ts` — Rider App (additional permissions)**
```typescript
export default {
  name: "RiderGuy Rider",
  slug: "riderguy-rider",
  ios: {
    bundleIdentifier: "com.riderguy.rider",
    infoPlist: {
      // All client permissions +
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "RiderGuy needs your location at all times to share it with customers during deliveries",
      UIBackgroundModes: ["location", "audio", "fetch", "remote-notification"]
    }
  },
  android: {
    package: "com.riderguy.rider",
    permissions: [
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
      "CAMERA",
      "READ_MEDIA_IMAGES",
      "VIBRATE"
    ]
  },
  plugins: [
    ["expo-location", {
      locationAlwaysAndWhenInUsePermission: "...",
      isIosBackgroundLocationEnabled: true,
      isAndroidBackgroundLocationEnabled: true
    }],
    "expo-task-manager",
    "expo-keep-awake",
    ["expo-av", { microphonePermission: false }],
    // ...same as client
  ]
};
```

**Environment Variables**
```bash
# Both apps — in .env files (EXPO_PUBLIC_ prefix makes them available in JS)
EXPO_PUBLIC_API_URL=https://api.riderguy.com/api/v1
EXPO_PUBLIC_SOCKET_URL=https://api.riderguy.com
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...    # Restricted to mobile bundle IDs only

# Rider app only
EXPO_PUBLIC_RIDER_LOCATION_INTERVAL_MS=10000
EXPO_PUBLIC_RIDER_HEARTBEAT_MS=30000
EXPO_PUBLIC_RIDER_OFFER_COUNTDOWN=30
```

---

### Phase 11 — QA & Polish (Days 110–118)

**Testing Matrix**

| Platform | Device | What to test |
|---|---|---|
| iOS Simulator | iPhone 15 Pro | Main flows, maps, animations |
| iOS Simulator | iPhone SE 3rd gen | Small screen layout |
| Android Emulator | Pixel 8 (API 34) | Main flows, permissions |
| Android Emulator | API 29 device | Older Android compatibility |
| Physical iOS device | Any iPhone | Push notifications, biometric, GPS, camera |
| Physical Android device | Any Android | Background location, foreground service notification |

**Critical Test Scenarios**
- Full order booking flow (client) end-to-end with real backend
- Full delivery flow (rider) end-to-end: go online → receive offer → accept → navigate → complete → proof of delivery
- App killed → push notification arrives → tap → opens correct screen
- Background GPS: rider goes online, locks phone, GPS still emits every 10s (verify in backend logs)
- Socket disconnect → reconnect → missed events replayed (use `since` timestamp)
- Offline: no network → cached data shown → come back online → fresh data fetched
- Low battery / battery saver mode (Android restricts background location — test and handle)
- iOS permission denial: location → graceful error, guide user to Settings
- iOS permission denial: notifications → explain impact, show link to Settings
- Biometric: enrolled device → works; not enrolled → falls back to PIN

**Polish Checklist**
- [ ] App icon (1024×1024 master PNG, EAS auto-resizes for all sizes)
- [ ] Splash screen (branded green background + logo)
- [ ] Android adaptive icon (foreground + background layers)
- [ ] All safe area insets handled (notch, Dynamic Island, home indicator)
- [ ] Dark mode: decide to support or lock to light mode (web is light-only)
- [ ] Loading skeletons on all data-fetching screens
- [ ] Empty states on all list screens
- [ ] Error states with retry buttons
- [ ] Haptic feedback on key interactions (accept job, complete delivery, PIN confirm)
- [ ] App Store screenshots generated (6.7", 5.5" for iOS; various for Android)

---

### Phase 12 — App Store Submission (Days 118–125)

**Build production binaries:**
```bash
eas build --platform all --profile production --non-interactive
```
This triggers cloud builds on EAS servers (Mac Mini for iOS, Linux for Android). Takes ~15–30 minutes.

**Submit to stores:**
```bash
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

**Apple App Store Connect (per app):**
- App name, subtitle, description, keywords (critical for search ranking)
- Category: Travel → Navigation
- Age rating questionnaire
- Privacy policy URL (required — must exist before submission)
- Data privacy labels (location data, usage data, identifiers)
- Pricing: Free
- Screenshots: 6.7" (required), 5.5" (required), iPad 12.9" (optional)
- App review notes: explain Ghana Card login, rider verification flow

**Google Play Console (per app):**
- Store listing: title, short description, full description
- Category: Travel & Navigation (client) / Business (rider)
- Content rating questionnaire
- Data safety form (location sharing, personal data — be thorough)
- Internal testing → Closed testing → Production rollout (20% → 50% → 100%)
- Screenshots: phone, 7" tablet, 10" tablet

**Review timelines:**
- Apple: 24–72 hours (first submission often flagged for review, subsequent updates faster)
- Google: 1–3 days for initial review, 2–24 hours for updates

---

## 12-Week Timeline

| Week | Deliverable |
|---|---|
| **0** | Register Apple Developer + Google Play Console + EAS accounts. Firebase iOS/Android apps. Google Maps mobile API key. |
| **1** | Both Expo apps scaffolded in monorepo. Turbo + Metro configured. EAS credentials set up. |
| **2** | `packages/auth-native` complete. API client + React Query + Socket.io hook working. |
| **3** | Client auth screens done. Rider auth + onboarding KYC screens done. Push notifications wired. |
| **4** | Google Maps integration. Native UI component library (Button, Input, OTP, Card, Badge, etc.). |
| **5** | Client: Dashboard home, Quick Send (all 4 steps), location autocomplete. |
| **6** | Client: Order tracking (live map), wallet, all settings screens. |
| **7** | Rider: Dashboard home with all hooks, GPS online/offline system, wake lock, iOS audio. |
| **8** | Rider: Background GPS, job offer modal (countdown + audio + haptic), job detail + navigation. |
| **9** | Rider: Earnings + withdrawal flow, gamification, community, proof of delivery. |
| **10** | Both apps: all `app.config.ts` permissions, all native plugins configured and tested. |
| **11** | QA on simulators + physical devices. Icons, splash screens, screenshots, empty/error states. |
| **12** | EAS production builds. App Store Connect + Play Console submissions. |

---

## What Changes vs What Stays the Same

### Zero changes required:
- **Backend API** — every endpoint, every socket event, every auth method stays exactly the same
- **`@riderguy/types`** — all TypeScript interfaces
- **`@riderguy/utils`** — all geo, format, date, and constant functions
- **`@riderguy/validators`** — all Zod schemas
- **Firebase project** — same project, same FCM sender ID
- **Google Maps API** — same key, new platform restrictions added

### New code (native layer only):
- 2 Expo app directories (`client-native`, `rider-native`)
- 1 new package (`auth-native`)
- React Native UI components (no HTML, no Radix UI, no Tailwind web config)
- Expo Router navigation files
- Native permission configurations

### Biggest wins over the PWA:
| Feature | PWA Limitation | Native Advantage |
|---|---|---|
| Background GPS | Suspended by iOS after ~30s | Runs indefinitely via background location task |
| Push notifications | Only works when PWA is installed to home screen | Works for any installed app |
| Job offer alerts | Silent when app is closed | Full notification with sound + badge |
| Biometric login | WebAuthn (limited iOS support) | Native FaceID / TouchID via secure keychain |
| Camera (POD) | Web camera API, limited control | Full camera access, flash, focus |
| App Store presence | Not discoverable in stores | Listed in App Store + Play Store |
| Offline storage | Limited localStorage | Full AsyncStorage + SecureStore + SQLite |

---

*Last updated: May 2026*
