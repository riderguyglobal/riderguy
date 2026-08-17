# New production server reset

Status: required before the next production deployment.

The previous Hetzner account and server are not recoverable. This is a clean
infrastructure rebuild, not a restore or in-place upgrade.

## Product boundary

The replacement server hosts only:

- the API (`apps/api`);
- the marketing and policy site (`apps/marketing`);
- the operations admin (`apps/admin`);
- PostgreSQL, Redis, uploads, reverse proxy, TLS, monitoring, and backups.

The customer and rider native apps are delivered through Google Play/EAS. The
archived PWAs must not be started by PM2 or included in production builds.

## Credentials to replace

Issue fresh values instead of copying values from the lost server:

- PostgreSQL application and backup passwords;
- Redis password;
- JWT access and refresh secrets;
- Gmail/Workspace app password;
- Paystack secret key and webhook secret/configuration;
- mNotify key;
- Firebase Admin service account key;
- server-restricted Google Maps key;
- SourceID and other third-party API keys;
- deploy-user SSH keys and GitHub deploy credentials;
- monitoring, backup-storage, and DNS-provider credentials.

Review and revoke the old values at every provider. The repository is public,
and an obsolete production environment file existed in Git history; rotation is
required even if a value looks inactive.

Android upload keystores are not server credentials. Keep each keystore and its
password in a secure vault because Google Play updates must continue using the
registered upload identity. Rotate an upload key only through the Play Console
recovery process when necessary.

## Data decision

Before deployment, explicitly choose one of these states:

1. restore a verified external database/uploads backup; or
2. launch a new empty production database and communicate the data reset.

Do not run seed scripts against production until that decision is approved.

## Provisioning inputs still required

- new server provider, public IP, Linux distribution, and server size;
- DNS access for `api.myriderguy.com`, `myriderguy.com`, and admin hostnames;
- SSH public key for the initial administrator and deploy user;
- the chosen backup destination and retention policy;
- all newly issued runtime secrets;
- confirmation of whether a database/uploads backup exists outside Hetzner.

## Deployment sequence

1. Provision and patch a new Ubuntu LTS server.
2. Create a non-root deploy user and harden SSH/firewall access.
3. Install Node.js, PostgreSQL, Redis, Nginx, Certbot, and the process manager.
4. Clone the public source and create the production environment file locally
   on the server with mode `600`; never commit it.
5. Generate Prisma, apply migrations, and restore approved data if available.
6. Build only API, marketing, and admin workspaces.
7. Start those three services and configure Nginx/TLS.
8. update DNS, then verify health, auth, payment webhooks, push delivery, maps,
   uploads, account deletion, and native end-to-end ride lifecycle.
9. Configure encrypted off-server database/uploads backups and test a restore.
10. Update the native EAS production URLs only if the public API hostname changes.
