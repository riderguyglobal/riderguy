const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const {
  REVIEWER_REQUIRED_DOCUMENTS,
  ensureApprovedReviewerDocuments,
  resolveReviewerPassword,
} = require('./seed-test-accounts');

function documentClient({ fixtureFor, latestFor }) {
  const creates = [];
  const updates = [];
  return {
    creates,
    updates,
    client: {
      findUnique: async ({ where }) => fixtureFor?.(where.id) ?? null,
      findFirst: async ({ where }) => latestFor?.(where.type) ?? null,
      create: async (args) => {
        creates.push(args);
        return args.data;
      },
      update: async (args) => {
        updates.push(args);
        return args.data;
      },
    },
  };
}

test('requires an explicit reviewer password in production while preserving the local fallback', () => {
  assert.throws(
    () => resolveReviewerPassword({ NODE_ENV: 'production' }),
    /PLAY_REVIEW_PASSWORD is required/,
  );
  assert.throws(
    () => resolveReviewerPassword({ NODE_ENV: 'production', PLAY_REVIEW_PASSWORD: '   ' }),
    /PLAY_REVIEW_PASSWORD is required/,
  );
  assert.equal(resolveReviewerPassword({ NODE_ENV: 'test' }), 'Test1234');
  assert.equal(
    resolveReviewerPassword({
      NODE_ENV: 'production',
      PLAY_REVIEW_PASSWORD: 'configured-reviewer-password',
    }),
    'configured-reviewer-password',
  );
});

test('creates one latest approved synthetic record for every required reviewer document', async () => {
  const now = new Date('2026-09-05T12:00:00.000Z');
  const previous = new Date('2026-09-06T12:00:00.000Z');
  const documents = documentClient({
    latestFor: (type) => ({ id: `existing-${type}`, createdAt: previous }),
  });

  await ensureApprovedReviewerDocuments({ document: documents.client }, 'play-reviewer-user', now);

  assert.equal(documents.updates.length, 0);
  assert.equal(documents.creates.length, REVIEWER_REQUIRED_DOCUMENTS.length);
  for (const [index, evidence] of REVIEWER_REQUIRED_DOCUMENTS.entries()) {
    const created = documents.creates[index].data;
    assert.equal(created.id, evidence.id);
    assert.equal(created.userId, 'play-reviewer-user');
    assert.equal(created.type, evidence.type);
    assert.equal(created.status, 'APPROVED');
    assert.equal(created.fileSizeBytes, 2510676);
    assert.equal(created.rejectionReason, null);
    assert.equal(created.createdAt.getTime(), previous.getTime() + 1);
  }
});

test('repairs the deterministic fixture in place without touching other evidence', async () => {
  const now = new Date('2026-09-05T12:00:00.000Z');
  const fixtureDate = new Date('2026-09-04T12:00:00.000Z');
  const fixtureById = new Map(
    REVIEWER_REQUIRED_DOCUMENTS.map((evidence) => [
      evidence.id,
      {
        id: evidence.id,
        userId: 'play-reviewer-user',
        type: evidence.type,
        status: 'PENDING',
        createdAt: fixtureDate,
      },
    ]),
  );
  const documents = documentClient({
    fixtureFor: (id) => fixtureById.get(id),
    latestFor: (type) =>
      fixtureById.get(REVIEWER_REQUIRED_DOCUMENTS.find((evidence) => evidence.type === type).id),
  });

  await ensureApprovedReviewerDocuments({ document: documents.client }, 'play-reviewer-user', now);

  assert.equal(documents.creates.length, 0);
  assert.equal(documents.updates.length, REVIEWER_REQUIRED_DOCUMENTS.length);
  for (const updated of documents.updates) {
    assert.equal(updated.data.status, 'APPROVED');
    assert.equal(updated.data.createdAt.getTime(), fixtureDate.getTime());
  }
});

test('fails closed when a reserved fixture ID belongs to another identity', async () => {
  const reserved = REVIEWER_REQUIRED_DOCUMENTS[0];
  const documents = documentClient({
    fixtureFor: (id) =>
      id === reserved.id
        ? {
            id,
            userId: 'another-user',
            type: reserved.type,
            status: 'APPROVED',
            createdAt: new Date(),
          }
        : null,
  });

  await assert.rejects(
    ensureApprovedReviewerDocuments({ document: documents.client }, 'play-reviewer-user'),
    /Reserved Play reviewer document ID collision/,
  );
  assert.equal(documents.creates.length, 0);
  assert.equal(documents.updates.length, 0);
});

test('data migration remains narrowly scoped and non-destructive', () => {
  const migration = readFileSync(
    join(
      __dirname,
      '..',
      'packages',
      'database',
      'prisma',
      'migrations',
      '20260905130000_repair_play_reviewer_required_documents',
      'migration.sql',
    ),
    'utf8',
  );

  assert.match(migration, /account\."phone" = '\+233200000001'/);
  assert.match(migration, /account\."firstName" = 'Play'/);
  assert.match(migration, /account\."lastName" = 'Reviewer Rider'/);
  assert.match(migration, /account\."role" = 'RIDER'/);
  assert.match(migration, /account\."roles" @> ARRAY\['RIDER'::"UserRole"\]/);
  assert.doesNotMatch(migration, /SET\s+"referralCode"/i);
  assert.match(migration, /ON CONFLICT \("id"\) DO UPDATE/);
  assert.match(migration, /\n\s*2510676,\n/);
  assert.match(migration, /\bBEGIN;/);
  assert.match(migration, /\bCOMMIT;/);
  assert.match(migration, /without exactly one strict Rider fixture match/);
  assert.match(migration, /rider\."onboardingStatus" = 'ACTIVATED'/);
  assert.match(migration, /rider\."isVerified" IS TRUE/);
  assert.match(migration, /document\."id" = required\."id"/);
  assert.match(migration, /latest-evidence invariant/);
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+"documents"/i);
  for (const evidence of REVIEWER_REQUIRED_DOCUMENTS) {
    assert.match(migration, new RegExp(evidence.id));
  }
});
