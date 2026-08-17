# RiderGuy Hetzner Server
# CX43 - 8 vCPU / 16GB RAM / 160GB SSD

## Server Details
- **Host**: 178.104.193.184
- **IPv6**: 2a01:4f8:1c18:3d69::/64
- **OS**: Ubuntu 24.04 LTS
- **Specs**: 8 vCPU, 16GB RAM, 160GB SSD
- **Location**: Nuremberg, Germany (eu-central)
- **SSH Key**: ~/.ssh/riderguy-hetzner

## SSH Access
```bash
# Root access (initial setup)
ssh riderguy

# Deploy user (after setup)
ssh riderguy-deploy
```

## Stack to Install
- Node.js 22
- PostgreSQL 16
- Redis 7
- Nginx
- PM2
- Certbot (SSL)
- fail2ban
- UFW firewall

## Directory Structure
```
/var/www/riderguy/
  source/     # Application code
  uploads/    # User uploads (documents, photos)
  logs/       # App + Nginx logs
  backups/    # Database backups
```

## Services

| Service | Port | Domain |
|---------|------|--------|
| Marketing | 3000 | myriderguy.com |
| Rider App | 3001 | rider.myriderguy.com |
| Client App | 3002 | app.myriderguy.com |
| Admin | 3003 | admin.myriderguy.com |
| API | 4000 | api.myriderguy.com |
| PostgreSQL | 5432 | localhost only |
| Redis | 6379 | localhost only |
