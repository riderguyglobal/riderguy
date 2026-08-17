# RiderGuy Rider — App Content Answers (copy-paste sheet)

Package: `com.riderguy.rider` · Last updated: 2026-06-11
Every Play Console → **App content** form for the Rider app, in the order the console lists them, with the exact option to pick and the exact text to paste.

Reviewer credentials below were **verified working against the production API on 2026-06-11**.

---

## 1. Sign in details (App access)

**Is any part of your app restricted?** → **Yes**

Click **+ Add sign in details** and enter:

- **Name of sign in details:** `Rider reviewer account`
- **Username / email:** `rider@test.com`
- **Password:** `Test1234`
- **Any other information required to access your app** (paste):

```
Sign in: open the app, tap "Sign In", choose the Email tab, enter the email and
password above, tap "Sign in". No OTP or 2-step verification is required for this
account. The account is a fully approved delivery partner (onboarding complete).

To review core functionality:
1) After sign-in you land on the rider home screen.
2) Tap the green power button to "Go online". A background-location disclosure is
   shown, then the Android location permission prompts appear. Grant
   "Allow all the time" to enable delivery tracking.
3) While online, the app shows a live map with your position and waits for
   delivery job offers. Job offers, deliveries, earnings, wallet, community and
   settings are all accessible from the bottom tabs.
4) The service operates in Ghana. If reviewing from outside Ghana, the job feed
   may be empty, but all screens, the go-online flow, permissions, maps,
   earnings, and account features remain fully reviewable. Setting a mock
   location in Accra, Ghana (5.6037, -0.1870) will show the full experience.

Account deletion is available in-app at Profile → Delete Account and at
https://myriderguy.com/delete-account.
```

---

## 2. Ads

**Does your app contain ads?** → **No**

---

## 3. Content rating (IARC questionnaire)

- **Email address:** `hello@myriderguy.com`
- **Category:** **Utility, Productivity, Communication, or Other** (all "Other" app types — not a game)

Answers:

| Question | Answer |
|---|---|
| Violence (realistic, fantasy, graphic) | **No** |
| Fear / horror / scary content | **No** |
| Sexual content / nudity | **No** |
| Profanity or crude humor | **No** |
| Drugs, alcohol, tobacco references or use | **No** |
| Gambling (simulated or real money) | **No** |
| Does the app allow users to interact or exchange content (chat, etc.)? | **Yes** — in-app 1:1 chat between rider and customer during a delivery |
| Does the app share the user's current location with other users? | **Yes** — the rider's live location is shared with the customer during an active delivery |
| Does the app allow users to purchase digital goods? | **No** (payments are for physical delivery services only) |
| Does the app contain user-generated content shared publicly? | **No** (chat is private 1:1, order-scoped) |
| Does the app promote/sell controlled substances, weapons, etc. | **No** |
| Is the app a web browser or search engine? | **No** |
| News or current-affairs app? | **No** |

Expected rating: Everyone / PEGI 3 (with "Users interact" + "Shares location" interactive elements).

---

## 4. Target audience and content

- **Target age group:** tick **18 and over** ONLY.
- **Could your store listing unintentionally appeal to children?** → **No**

---

## 5. News apps

**Is your app a news app?** → **No**

---

## 6. COVID-19 contact tracing and status apps

→ **My app is not a publicly available COVID-19 contact tracing or status app**

---

## 7. Data safety

**Overview answers:**

- Does your app collect or share any of the required user data types? → **Yes**
- Is all of the user data collected by your app encrypted in transit? → **Yes**
- Do you provide a way for users to request that their data is deleted? → **Yes**
  - Account deletion URL: `https://myriderguy.com/delete-account`

**Data types — tick exactly these:**

### Location
| Type | Collected | Shared | Processed ephemerally | Required/Optional | Purposes |
|---|---|---|---|---|---|
| Approximate location | Yes | No | No | Required | App functionality |
| Precise location | Yes | **Yes** (with the customer and support during an active delivery) | No | Required (to go online / deliver) | App functionality |

> When asked "Is this data collected, shared, or both?" for precise location → **Collected and shared**. Sharing purpose → App functionality.

### Personal info
| Type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| Name | Yes | Yes (shown to the customer of an assigned delivery) | Required | App functionality, Account management |
| Email address | Yes | No | Required | Account management |
| Phone number | Yes | Yes (customer can call during an active delivery) | Required | App functionality, Account management |
| Address | Yes | No | Required | App functionality |
| Other IDs (Government / national ID — Ghana Card, for identity verification) | Yes | No | Required | Account management, Fraud prevention |

### Financial info
| Type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| User payment info (payout destination: mobile-money / bank details) | Yes | Yes (payment processor Paystack to execute payouts) | Required for withdrawals | App functionality |
| Other financial info (earnings, wallet balance, transactions) | Yes | No | Required | App functionality |

### Photos and videos
| Type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| Photos | Yes | Yes (proof-of-delivery photo visible to the customer of that order) | Required (onboarding docs, proof of delivery) | App functionality, Account management |

### Messages
| Type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| Other in-app messages (order chat) | Yes | Yes (the customer in the same order chat) | Optional | App functionality |

### App activity
| Type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| App interactions (orders, job history, ratings) | Yes | No | Required | App functionality, Analytics |

### App info and performance
| Type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| Crash logs | Yes | No | Optional | App functionality |
| Diagnostics | Yes | No | Optional | App functionality |

### Device or other IDs
| Type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| Device or other IDs (FCM push token, install ID) | Yes | No | Required (notifications) | App functionality |

**Not collected** (leave unticked): Race/ethnicity, political/religious beliefs, sexual orientation, health & fitness, web browsing history, contacts, calendar, audio files, music, videos (user library), files & docs, emails or SMS, installed apps, advertising ID.

> "Is data sold?" — No data is sold. No data is collected for advertising/marketing purposes.

---

## 8. Government apps

**Is your app developed by or on behalf of a government?** → **No**

---

## 9. Financial features

- **Does your app provide any financial features?** → select **My app doesn't provide any of these financial features** *if the form's listed categories are only loans/crypto/investments/banking* — the rider wallet is a stored-value account for service earnings, not a consumer financial product.
- If the form version includes a broader "digital wallets / money transfer" option, instead declare: **Digital wallet** with description:

```
The app includes an earnings wallet for approved delivery partners. Delivery
earnings accumulate in the wallet and can be withdrawn to the partner's own
mobile-money or bank account via the licensed payment processor Paystack.
The app does not offer loans, credit, cryptocurrency, investments, gambling,
or person-to-person transfers.
```

---

## 10. Health apps

**Is your app a health app?** → **No / My app does not have any health features**

---

## 11. Sensitive app permissions → Location permissions (background location) — *most scrutinized form*

**Does your app access location in the background?** → **Yes**

- **Primary use case:** **Delivery / ride sharing — sharing a user's location with other users during an active trip/delivery** (pick the closest option offered, e.g. "User-initiated sharing of location with other users").
- **Why does your app need background location?** (paste):

```
RiderGuy Rider is an app for delivery partners. When a rider goes online, the app
must share their live location with the customer of an active delivery and with
dispatch support, and match them with nearby delivery jobs — including when the
app is in the background or the screen is off, because riders ride with the phone
locked or while using a navigation app. A persistent foreground-service
notification is displayed the entire time tracking is active, and all location
collection stops immediately when the rider goes offline. Background location is
core functionality: without it, live delivery tracking and job dispatch break.
```

- **In-app prominent disclosure** (already implemented; shown before the runtime permission):

```
RiderGuy Rider collects location in the background — when the app is closed or
not in use — to share your live location with customers and support during
active deliveries and to match you with nearby jobs while you are online.
Tracking stops when you go offline.
```

- **Demo video:** upload an unlisted YouTube link showing, in ≤30s: (1) tapping "Go online", (2) the in-app disclosure, (3) the Android "Allow all the time" prompt, (4) the persistent tracking notification, (5) the rider's live position on the map. Shot list is in `PLAY_CONSOLE_SETUP_KIT.md` §10.

---

## 12. Foreground service permissions (`FOREGROUND_SERVICE_LOCATION`)

- **What feature uses this?** (paste):

```
While a delivery partner is online or completing a delivery, the app runs a
location foreground service that shows a persistent notification ("RiderGuy is
online — your location is shared while you receive and complete jobs"). It keeps
live delivery tracking and job dispatch working when the app is backgrounded.
The service starts only after the rider explicitly goes online and stops when
they go offline or the delivery ends.
```

- **User benefit:** customers and support can see live delivery progress; riders receive job offers while the phone is locked.
- **Demo video:** same video as Section 11.

---

## 13. Store settings / contact details (verify — already API-pushed)

- **Category:** Business · **Tags:** delivery driver, courier, earnings, logistics
- **Contact email:** `hello@myriderguy.com` · **Website:** `https://myriderguy.com`
- **Privacy policy URL:** `https://myriderguy.com/privacy`
- **Account deletion URL:** `https://myriderguy.com/delete-account`

---

## Client app (com.riderguy.client) deltas

Use the same sheet with these changes: reviewer account `client@test.com` / `Test1234`
(also verified live 2026-06-11); **no background location** (skip §11–12 — answer "No" to
background location); Data safety drops Government ID and payout info but adds *payment
info for orders / wallet top-ups (shared with Paystack)*; precise location is **Optional**
(addresses can be typed manually); content rating identical (users interact = Yes,
shares location = Yes — the customer sees the rider's location, not vice-versa, but the
chat interaction answer stays Yes).
