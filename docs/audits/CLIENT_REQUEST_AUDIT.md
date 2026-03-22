# Client-Side Ride Request — Audit & Fix Plan

> Generated: 2026-03-19  
> Scope: `apps/client/src/app/(dashboard)/dashboard/send/page.tsx` and related components  

---

## Critical (Broken in Production)

- [x] **1. `scheduledAt` never sent — all scheduled orders fail server validation**  
  `NEXT_DAY` / `RECURRING` sets `isScheduled: true` but never includes `scheduledAt`. The Zod refine rejects it. No date/time picker exists on the form.

- [x] **2. Only 1 of 3 uploaded photos is actually sent**  
  `handleConfirm` sends `body.packagePhotoUrl = photoUrls[0]` — the other 2 uploaded photos are silently discarded.

- [x] **3. Card/MoMo orders can get stuck forever**  
  After creation the client redirects to `/payment`. If the user backs out, closes the browser, or the Paystack webhook never fires, the order sits in `PENDING` indefinitely with no timeout, cleanup job, or retry path.

- [x] **4. Price drift between estimate and order creation**  
  The estimate `useEffect` and `POST /orders` run at different times. Surge, weather, or time-of-day multipliers can change. The user confirms GHS 12 but may be charged GHS 18 — no tolerance check exists.

---

## High (Likely to Cause Issues)

- [x] **5. Promo code triggers estimate on every keystroke**  
  `promoCode` is in the estimate `useEffect` dependency array with no debounce. Typing `RIDE50` fires 6 API calls with partial codes that all fail validation.

- [x] **6. Failed photo uploads silently swallowed**  
  `uploadPackagePhotos` has a bare `catch {}`. If all uploads fail, the user thinks photos were attached but none were.

- [x] **7. Double-submit possible from confirmation modal**  
  Page-level `submitting` and modal-level `confirming` are independent guards. Rapid taps can desync them, sending two `POST /orders`.

- [x] **8. No error feedback when estimate fails**  
  The estimate catch sets `setEstimate(null)` but never calls `setError()`. A 400/500 from the API just shows "Enter both addresses."

- [x] **9. No service area / max distance check**  
  A user can book Accra → Kumasi (250 km). No coverage boundary exists, so the order sits in `SEARCHING_RIDER` forever.

---

## Medium (Functional but Suboptimal)

- [x] **10. WALLET payment method not exposed in UI**  
  The API and validator accept `WALLET` but the payment selector only shows MoMo / Cash / Card.

- [x] **11. Multi-stop estimate ≠ actual route cost**  
  Estimate receives `additionalStops: count` (flat surcharge), but real orders include full coordinates. The estimate undercharges for far-apart stops.

- [x] **12. Stale estimate visible behind confirmation modal**  
  If a dependency changes while the modal is open, the page `estimate` state updates but the modal holds its prop snapshot.

- [x] **13. No offline / network-loss handling**  
  Geocoding, estimates, uploads, and order creation all fail silently or with generic messages. No `navigator.onLine` check, retry, or queue for flaky mobile networks.

- [x] **14. No debounce on non-location estimate triggers**  
  Every packageType, paymentMethod, scheduleType, isExpress, or weight change fires an instant estimate request — unnecessary API churn.

- [x] **15. `SAME_DAY` schedule button is a no-op**  
  It isn't sent to the estimate (`scheduleType !== 'NOW'` passes but offers no discount) and doesn't set `isScheduled`. Functionally identical to "Now."

- [x] **16. Error set in two places on submission failure**  
  `handleConfirm` catches, calls `setError()`, then re-throws. The modal wrapper also catches and calls its own `setError()`. Only the modal error is visible.

---

## Low (Polish / Edge Cases)

- [x] **17. `canSubmit` doesn't check `api` readiness**  
  The Review button is enabled even if the auth token is expired / API client isn't ready.

- [x] **18. Weight input accepts non-numeric garbage**  
  `type="text"` + `parseFloat()` allows `"5.5.3"` or pasted letters. Server rejects via Zod but there's no inline feedback.

- [x] **19. Phone fields have zero validation**  
  Contact phone accepts any string up to 20 chars. `"hello"` passes.

- [x] **20. Photo delete button nearly invisible on mobile**  
  Desktop delete uses `opacity-0 group-hover:opacity-100` (impossible on touch). Mobile fallback is a 20×20px button overlaid on the image.

- [x] **21. Inaccurate geolocation silently used**  
  `getCurrentPosition` with 8s timeout on slow GPS can return a wildly inaccurate position with no accuracy indicator shown to the user.

- [x] **22. No visual cue when dropoff auto-focuses**  
  After pickup selection, `setTimeout(focus, 100)` jumps the cursor with no highlight or animation.

- [x] **23. Map re-init edge case**  
  `initMapCore` is async. If the component unmounts during init, the `cancelled` flag helps but doesn't await `destroy()`, potentially leaking a map instance.

---

## Progress Tracker

| # | Issue | Status |
|---|-------|--------|
| 1 | scheduledAt never sent | ✅ |
| 2 | Only 1 photo sent | ✅ |
| 3 | Card/MoMo orders stuck | ✅ |
| 4 | Price drift | ✅ |
| 5 | Promo keystroke spam | ✅ |
| 6 | Silent photo upload failure | ✅ |
| 7 | Double-submit | ✅ |
| 8 | No estimate error feedback | ✅ |
| 9 | No service area check | ✅ |
| 10 | WALLET not in UI | ✅ |
| 11 | Multi-stop estimate gap | ✅ |
| 12 | Stale modal estimate | ✅ |
| 13 | No offline handling | ✅ |
| 14 | No estimate debounce | ✅ |
| 15 | SAME_DAY no-op | ✅ |
| 16 | Double error catch | ✅ |
| 17 | canSubmit missing api check | ✅ |
| 18 | Weight input validation | ✅ |
| 19 | Phone field validation | ✅ |
| 20 | Photo delete UX | ✅ |
| 21 | Geolocation accuracy | ✅ |
| 22 | Dropoff focus cue | ✅ |
| 23 | Map cleanup edge case | ✅ |
