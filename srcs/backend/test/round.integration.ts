import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { createApplication } from '../src/main';
import { Database } from '../src/database';
import { Sessions } from '../src/sessions';
import { Scoring } from '../src/scoring';
import { CHALLENGE_ID, type RoundPrompt } from '../src/rounds';
import type { Challenge, GameResult } from '../../core/game-engine';

test('persisted round boundaries, concurrency, recovery and restart', async t => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required; use only a local development database.');
  const originalUrl = process.env.DATABASE_URL;
  const testUrl = new URL(originalUrl);
  assert.ok(['127.0.0.1', 'localhost', 'db'].includes(testUrl.hostname), 'Integration tests require a local development database.');
  const schema = `cube_test_${randomUUID().replaceAll('-', '')}`;
  testUrl.searchParams.set('schema', schema);
  process.env.DATABASE_URL = testUrl.toString();
  process.env.ENABLE_DEV_SESSION = 'true';
  const db = new PrismaClient();
  t.after(async () => {
    // Identifier is generated locally from a UUID; never accepts user input.
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.$disconnect();
    process.env.DATABASE_URL = originalUrl;
  });
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: process.env, stdio: 'ignore' });
  execFileSync(process.execPath, ['dist/backend/src/seed.js'], { env: process.env, stdio: 'ignore' });
  const state = { app: await createApplication(), base: '' };
  await state.app.listen(0, '127.0.0.1');
  state.base = await state.app.getUrl();
  t.after(async () => { await state.app.close(); });
  const call = (path: string, cookie = '', method = 'GET', body?: unknown) => fetch(`${state.base}/api${path}`, {
    method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const guest = async () => {
    const response = await call('/dev/session', '', 'POST');
    assert.equal(response.status, 201);
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    assert.match(response.headers.get('set-cookie')!, /HttpOnly/);
    const userId = await state.app.get(Sessions).identify(cookie);
    assert.ok(userId);
    return cookie;
  };
  const create = async (cookie: string) => {
    const response = await call('/rounds', cookie, 'POST');
    assert.equal(response.status, 201);
    const prompt = await response.json() as RoundPrompt;
    return prompt;
  };
  const cookie = await guest();
  const other = await guest();
  const prompt = await create(cookie);
  const storedChallenge = await db.challenge.findUniqueOrThrow({ where: { id: CHALLENGE_ID } });
  const geometry = storedChallenge.geometry as unknown as Challenge;
  const drawing = { inputVersion: 1, strokes: geometry.edges.filter(edge => edge.role === 'target').map(edge => ({ points: edge.points })) };

  await t.test('requires identity, enforces ownership and hides scoring geometry', async () => {
    assert.equal((await call('/rounds', '', 'POST')).status, 401);
    assert.equal((await call(`/rounds/${prompt.roundId}`, other)).status, 404);
    assert.equal((await call(`/rounds/${prompt.roundId}/result`, other)).status, 404);
    assert.equal((await call('/rounds/not-a-uuid', cookie)).status, 400);
    assert.deepEqual(Object.keys(prompt).sort(), ['endsAt', 'referenceEdges', 'roundId', 'startsAt']);
    assert.ok(prompt.referenceEdges.length > 0);
    assert.deepEqual(Object.keys(prompt.referenceEdges[0]), ['points']);
    assert.deepEqual(await (await call(`/rounds/${prompt.roundId}/result`, cookie)).json(), { status: 'pending' });
  });

  await t.test('validates at the boundary and rejects cross-origin requests', async () => {
    for (const body of [{ ...drawing, userId: randomUUID() }, { inputVersion: 1, strokes: [{ points: [{ x: -1, y: 0 }] }] }]) {
      assert.equal((await call(`/rounds/${prompt.roundId}/submission`, cookie, 'POST', body)).status, 400);
    }
    const forged = await fetch(`${state.base}/api/dev/session`, { method: 'POST', headers: { Origin: 'https://untrusted.example' } });
    assert.equal(forged.status, 403);
    const oversized = await fetch(`${state.base}/api/rounds/${prompt.roundId}/submission`, {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(2100000) }),
    });
    assert.equal(oversized.status, 413);
  });

  await t.test('concurrent submissions accept exactly one immutable drawing', async () => {
    const replies = await Promise.all(Array.from({ length: 6 }, () => call(`/rounds/${prompt.roundId}/submission`, cookie, 'POST', drawing)));
    assert.equal(replies.filter(r => r.status === 201).length, 1);
    assert.equal(replies.filter(r => r.status === 409).length, 5);
    const saved = await db.submission.findMany({ where: { participant: { roundId: prompt.roundId } } });
    assert.equal(saved.length, 1); assert.deepEqual(saved[0].drawing, drawing);
  });

  await t.test('concurrent workers persist one official result only after closure', async () => {
    const database = state.app.get(Database);
    const worker = new Scoring(database);
    assert.equal(await worker.processOne(), false);
    await setTimeout(10);
    await db.round.update({ where: { id: prompt.roundId }, data: { endsAt: new Date(Date.now() - 1) } });
    await Promise.all([worker.processOne(), new Scoring(database).processOne()]);
    assert.equal(await db.roundResult.count({ where: { roundId: prompt.roundId } }), 1);
    assert.equal((await db.scoringJob.findUniqueOrThrow({ where: { roundId: prompt.roundId } })).status, 'done');
    const publication = await (await call(`/rounds/${prompt.roundId}/result`, cookie)).json() as { status: string; result: GameResult };
    assert.equal(publication.status, 'complete');
    assert.deepEqual(publication.result.players[0].drawing, drawing);
    assert.equal(publication.result.players[0].score, 100);
    const before = await db.roundResult.findUniqueOrThrow({ where: { roundId: prompt.roundId } });
    await worker.processOne();
    assert.deepEqual(await db.roundResult.findUniqueOrThrow({ where: { roundId: prompt.roundId } }), before);
  });

  await t.test('expired leases recover and missing submissions score empty with timeout metadata', async () => {
    const missing = await create(cookie);
    await setTimeout(10);
    await db.round.update({ where: { id: missing.roundId }, data: { endsAt: new Date(Date.now() - 1) } });
    assert.equal((await call(`/rounds/${missing.roundId}/submission`, cookie, 'POST', drawing)).status, 409);
    await db.scoringJob.update({ where: { roundId: missing.roundId }, data: {
      status: 'running', claimToken: randomUUID(), leaseUntil: new Date(Date.now() - 1), attempts: 1,
    } });
    await new Scoring(state.app.get(Database)).processOne();
    const publication = await (await call(`/rounds/${missing.roundId}/result`, cookie)).json() as {
      result: GameResult; participants: readonly { timedOut: boolean }[];
    };
    assert.deepEqual(publication.result.players[0].drawing.strokes, []);
    assert.equal(publication.result.players[0].score, 0);
    assert.equal(publication.participants[0].timedOut, true);
    assert.equal((await db.scoringJob.findUniqueOrThrow({ where: { roundId: missing.roundId } })).attempts, 2);
  });

  await t.test('session and result survive an API restart', async () => {
    const before = await (await call(`/rounds/${prompt.roundId}/result`, cookie)).json();
    await state.app.close();
    state.app = await createApplication();
    await state.app.listen(0, '127.0.0.1'); state.base = await state.app.getUrl();
    assert.deepEqual(await (await call(`/rounds/${prompt.roundId}/result`, cookie)).json(), before);
  });

  await t.test('development sessions are disabled outside opted-in development', async () => {
    process.env.ENABLE_DEV_SESSION = 'false';
    assert.equal((await call('/dev/session', cookie, 'POST')).status, 404);
    assert.equal((await call(`/rounds/${prompt.roundId}`, cookie)).status, 401);
    process.env.ENABLE_DEV_SESSION = 'true';
    process.env.NODE_ENV = 'production';
    assert.equal(await state.app.get(Sessions).identify(cookie), null);
    process.env.NODE_ENV = 'test';
  });

  const challenge = await db.challenge.findUniqueOrThrow({ where: { id: CHALLENGE_ID } });
  assert.equal((challenge.geometry as unknown as Challenge).challengeVersion, 2);
});
