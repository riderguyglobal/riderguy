# Archived PWA apps

Archived on 2026-06-11 as part of the transition from web PWAs to the native
Android apps (`apps/client-native`, `apps/rider-native`).

| App | Former path | Former host | Replacement |
| --- | --- | --- | --- |
| Client PWA (`@riderguy/client-app`) | `apps/client` | app.myriderguy.com | `apps/client-native` (`com.riderguy.client` on Google Play) |
| Rider PWA (`@riderguy/rider-app`) | `apps/rider` | rider.myriderguy.com | `apps/rider-native` (`com.riderguy.rider` on Google Play) |

These folders are out of the npm workspace globs (`apps/*`), so they are not
installed, built, type-checked, or uploaded to EAS anymore.

The former production server is no longer available. Replacement infrastructure
must not start `riderguy-client` or `riderguy-rider`; the native Google Play apps
are now the active customer and rider products.

To restore an app: `git mv archive/pwa/<app> apps/<app>` and run `npm install`.
