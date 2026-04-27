// ============================================================
// AUTH-01: API Key hashing helpers.
//
// Plaintext API keys are NEVER stored. We:
//   1. Generate a 32-byte random key with a "rg_live_" / "rg_test_" prefix.
//   2. Hash it with SHA-256 and store the hash in `ApiKey.keyHash`.
//   3. Store the first 8 chars (the visible prefix) in `ApiKey.keyPrefix`
//      for UI display + lookup narrowing.
//   4. Return the raw key to the caller exactly once at creation time.
//
// On verification:
//   - Hash the incoming key
//   - Look up by keyHash (unique)
//   - Use timing-safe comparison via the unique index (which is itself
//     constant-time at the DB level)
// ============================================================
import crypto from 'crypto';
import { prisma } from '@riderguy/database';

const KEY_BYTES = 32; // 256 bits of entropy
const ENV_PREFIX = process.env.NODE_ENV === 'production' ? 'rg_live_' : 'rg_test_';

/** Hash an API key with SHA-256, returning the lowercase hex digest. */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

/** Generate a new random API key (raw, unhashed). */
export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const random = crypto.randomBytes(KEY_BYTES).toString('base64url');
  const raw = `${ENV_PREFIX}${random}`;
  const prefix = raw.slice(0, 8); // e.g. "rg_live_"
  const hash = hashApiKey(raw);
  return { raw, prefix, hash };
}

/**
 * Issue a new API key for a business account.
 * Returns the RAW key — caller must show it once and not persist it.
 */
export async function issueApiKey(opts: {
  businessAccountId: string;
  name: string;
  expiresAt?: Date;
}): Promise<{ id: string; rawKey: string; prefix: string }> {
  const { raw, prefix, hash } = generateApiKey();
  const created = await prisma.apiKey.create({
    data: {
      businessAccountId: opts.businessAccountId,
      name: opts.name,
      keyHash: hash,
      keyPrefix: prefix,
      expiresAt: opts.expiresAt ?? null,
    },
    select: { id: true },
  });
  return { id: created.id, rawKey: raw, prefix };
}

/**
 * Verify an API key.
 * Returns the matching ApiKey row (without the hash) if valid + active,
 * else null. Updates lastUsedAt on success.
 */
export async function verifyApiKey(rawKey: string): Promise<{
  id: string;
  businessAccountId: string;
  name: string;
} | null> {
  if (!rawKey || rawKey.length < 16) return null;
  const hash = hashApiKey(rawKey);
  const row = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    select: {
      id: true,
      businessAccountId: true,
      name: true,
      isActive: true,
      expiresAt: true,
    },
  });
  if (!row) return null;
  if (!row.isActive) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;

  // Best-effort lastUsedAt update (don't await, don't block auth)
  prisma.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { id: row.id, businessAccountId: row.businessAccountId, name: row.name };
}
