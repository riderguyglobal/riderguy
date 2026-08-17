# RiderGuy

RiderGuy is a monorepo for the native Android delivery platform and its web
services. The native apps are the active customer and rider products. The old
PWAs are retained only as source history under `archive/pwa/`.

## Active products

| Area | Path | Deployment |
| --- | --- | --- |
| Customer Android app | `apps/client-native` | Expo EAS / Google Play (`com.riderguy.client`) |
| Rider Android app | `apps/rider-native` | Expo EAS / Google Play (`com.riderguy.rider`) |
| API | `apps/api` | Production server |
| Marketing and policy pages | `apps/marketing` | Production server |
| Operations admin | `apps/admin` | Production server |
| Shared native authentication | `packages/auth-native` | Bundled into both native apps |
| Shared packages | `packages/*` | Used by apps and API |

The Android projects under each native app are intentional source. They contain
the Play Store package identifiers, permission configuration, Gradle build
fixes, and release-signing hooks. Build output, keystores, service-account JSON,
Firebase configuration, environment files, and device captures are ignored.

## Archived products

- `archive/pwa/client`: former customer PWA
- `archive/pwa/rider`: former rider PWA

Archived apps are outside the npm workspace and are not installed, tested,
deployed, or uploaded to EAS.

## Local setup

```bash
npm ci
npm run type-check
npm run lint
```

Native app commands:

```bash
npm run dev --workspace=@riderguy/client-native
npm run dev --workspace=@riderguy/rider-native
npm run type-check --workspace=@riderguy/client-native
npm run type-check --workspace=@riderguy/rider-native
```

Production Android bundles are built through each app's EAS `production`
profile. Native apps call the public API; they are not hosted on the production
server.

## Production reset

The previous Hetzner server is no longer recoverable. Treat all old server
state, databases, uploads, backups, IP addresses, and credentials as unavailable.
The next deployment must start from a clean server using the repository source,
database migrations, and newly issued secrets. See
`docs/operations/NEW_SERVER_RESET.md` before provisioning or deploying.
