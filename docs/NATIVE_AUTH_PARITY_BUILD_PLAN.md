# Native Auth Parity Build Plan

## Goal

Bring the client and rider native apps to full auth parity with the backend auth contract, while keeping each app visually distinct and mobile-first.

## Backend Contract To Support

- Phone OTP request and verification: `/auth/otp/request`, `/auth/otp/verify`
- Phone account creation: `/auth/register`
- Email account creation: `/auth/register/email`
- Ghana Card account creation: `/auth/register/ghanacard`
- Google account auth: `/auth/google`
- Login by OTP, PIN, password, and Ghana Card
- Auth method discovery: `/auth/methods`
- Password reset: `/auth/forgot-password`, `/auth/reset-password`
- Email verification: `/auth/verify-email`, `/auth/resend-verification`
- PIN reset by OTP: `/auth/reset-pin`
- Recovery by phone, email, or Ghana Card security answer: `/auth/recovery/*`
- Session restore and role-aware routing after auth

## Build Order

1. Shared native auth service
   - Centralize token extraction, profile loading, role checks, OTP verification, registration, login, password reset, PIN reset, and recovery calls.
   - Keep low-level Axios setup in `@riderguy/auth-native`.

2. Native configuration
   - Add custom schemes for client and rider.
   - Add reset/verify callback route support inside Expo Router.
   - Prepare Android/iOS link config for reset-password and verify-email callbacks.

3. Client auth
   - Rebuild create account around phone, email, Ghana Card, and Google entry points.
   - Verify OTP before `/auth/register`.
   - Enforce exactly 6-digit PIN.
   - Add referral code and business-client role option.
   - Add reset password, verify email, and richer PIN recovery screens.
   - Validate role after login.

4. Rider auth
   - Rebuild create account around phone, email, Ghana Card, and Google entry points.
   - Verify OTP before `/auth/register`.
   - Enforce exactly 6-digit PIN.
   - Collect recovery security question for Ghana Card.
   - Add rider recovery hub: phone OTP, email reset, Ghana Card security answer, reset PIN.
   - Add reset password and verify email screens.
   - Validate rider role after login and route into rider onboarding.

5. Verification
   - Run type-checks for `@riderguy/auth-native`, `@riderguy/client-native`, `@riderguy/rider-native`, validators, and root workspace.
   - Fix regressions until type-checks are clean.

## Completion Criteria

- No native account creation path calls `/auth/register` before `/auth/otp/verify`.
- All native PIN creation/reset paths require exactly 6 numeric digits.
- Client supports phone, email, Ghana Card, Google placeholder/deep-link-ready auth, password reset, PIN reset, and email verification.
- Rider supports phone, email, Ghana Card, Google placeholder/deep-link-ready auth, password reset, recovery hub, PIN reset, and email verification.
- Shared auth behavior lives in `@riderguy/auth-native`.
- Native configs expose app schemes for auth callbacks.
