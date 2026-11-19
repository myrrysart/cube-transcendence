import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { PrismaClient } from '@prisma/client';
import { WebSocket } from 'ws';
import type { Account, RoomView } from '../../core/protocol';
import type { Challenge } from '../../core/game-engine';
import { createApplication } from '../src/main';
import { Scoring } from '../src/scoring';
import { Database } from '../src/database';
import { CHALLENGE_ID } from '../src/rounds';

test('accounts, four-player rooms and authenticated live result recovery', { timeout: 30000 }, async t => {
  assert.ok(process.env.DATABASE_URL);
  const originalUrl = process.env.DATABASE_URL;
  const testUrl = new URL(originalUrl);
  assert.ok(['localhost', '127.0.0.1', 'db'].includes(testUrl.hostname));
  const schema = `cube_multi_${randomUUID().replaceAll('-', '')}`;
  testUrl.searchParams.set('schema', schema); process.env.DATABASE_URL = testUrl.toString();
  process.env.ENABLE_DEV_SESSION = 'false';
  const db = new PrismaClient();
  t.after(async () => { await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await db.$disconnect(); process.env.DATABASE_URL = originalUrl; });
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: process.env, stdio: 'ignore' });
  execFileSync(process.execPath, ['dist/backend/src/seed.js'], { env: process.env, stdio: 'ignore' });
  const app = await createApplication();
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const sockets: WebSocket[] = [];
  t.after(async () => { for (const socket of sockets) socket.terminate(); await app.close(); });
  const call = (path: string, cookie = '', method = 'GET', body?: unknown) => fetch(`${base}/api${path}`, { method,
    headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const password = 'a long synthetic test password';
  const players: { account: Account; cookie: string; email: string }[] = [];
  await t.test('signup hashes passwords, login rotates sessions and logout revokes access', async () => {
    for (const index of [0, 1, 2, 3, 4]) {
      const email = `player-${index}@example.test`;
      const signedUp = await call('/auth/signup', '', 'POST', { email, password, label: `Player ${index}` });
      assert.equal(signedUp.status, 201);
      const account = await signedUp.json() as Account;
      assert.deepEqual(Object.keys(account).sort(), ['id', 'label']);
      const cookie = signedUp.headers.get('set-cookie')!.split(';')[0];
      const stored = await db.user.findUniqueOrThrow({ where: { email } });
      assert.ok(stored.passwordHash?.startsWith('scrypt-v1:'));
      assert.notEqual(stored.passwordHash, password);
      players.push({ account, cookie, email });
    }
    assert.notEqual((await db.user.findUniqueOrThrow({ where: { email: players[0].email } })).passwordHash,
      (await db.user.findUniqueOrThrow({ where: { email: players[1].email } })).passwordHash);
    const bad = await call('/auth/login', '', 'POST', { email: players[0].email, password: 'incorrect long password' });
    assert.equal(bad.status, 401);
    const oldCookie = players[0].cookie;
    const loggedIn = await call('/auth/login', oldCookie, 'POST', { email: players[0].email.toUpperCase(), password });
    assert.equal(loggedIn.status, 201);
    players[0].cookie = loggedIn.headers.get('set-cookie')!.split(';')[0];
    assert.notEqual(players[0].cookie, oldCookie);
    assert.equal((await call('/auth/me', oldCookie)).status, 401);
    assert.equal((await call('/auth/me', players[0].cookie)).status, 200);
    const loggedOut = await call('/auth/logout', players[4].cookie, 'POST');
    assert.equal(loggedOut.status, 201);
    assert.equal((await call('/auth/me', players[4].cookie)).status, 401);
    const login = await call('/auth/login', '', 'POST', { email: players[4].email, password });
    players[4].cookie = login.headers.get('set-cookie')!.split(';')[0];
  });

  const created = await call('/rooms', players[0].cookie, 'POST');
  const room = await created.json() as RoomView;
  await t.test('concurrent joins cannot exceed four, nonmembers are denied and readiness is authoritative', async () => {
    const joined = await Promise.all(players.slice(1).map(player => call(`/rooms/${room.roomId}/join`, player.cookie, 'POST')));
    assert.equal(joined.filter(response => response.status === 201).length, 3);
    assert.equal(joined.filter(response => response.status === 409).length, 1);
    assert.equal(await db.roomParticipant.count({ where: { roomId: room.roomId } }), 4);
    assert.equal((await call(`/rooms/${room.roomId}/start`, players[0].cookie, 'POST')).status, 409);
    assert.equal((await call(`/rooms/${room.roomId}/ready`, players[0].cookie, 'POST', { ready: true, userId: players[1].account.id })).status, 400);
  });
  const members = await db.roomParticipant.findMany({ where: { roomId: room.roomId } });
  const participating = players.filter(player => members.some(member => member.userId === player.account.id));
  const excluded = players.find(player => !members.some(member => member.userId === player.account.id))!;
  assert.equal((await call(`/rooms/${room.roomId}`, excluded.cookie)).status, 404);
  const origin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173';
  const live = (player: typeof players[number]) => {
    const state = { last: undefined as RoomView | undefined };
    const socket = new WebSocket(`${base.replace('http:', 'ws:')}/api/events?roomId=${room.roomId}`, { headers: { Cookie: player.cookie, Origin: origin } });
    sockets.push(socket);
    socket.on('message', raw => { state.last = (JSON.parse(String(raw)) as { room: RoomView }).room; });
    socket.on('error', () => undefined);
    return { socket, state };
  };
  const feeds = participating.map(live);
  const waitFor = async (predicate: () => boolean) => {
    for (const attempt of Array.from({ length: 100 }, (_, index) => index)) {
      if (predicate()) return;
      await setTimeout(50);
      assert.ok(attempt < 99, 'Expected live event was not delivered.');
    }
  };
  await waitFor(() => feeds.every(feed => !!feed.state.last));
  await t.test('ready/start changes reach all sockets with the same private prompt', async () => {
    for (const player of participating) assert.equal((await call(`/rooms/${room.roomId}/ready`, player.cookie, 'POST', { ready: true })).status, 201);
    const notHost = participating.find(player => player.account.id !== room.hostId)!;
    assert.equal((await call(`/rooms/${room.roomId}/start`, notHost.cookie, 'POST')).status, 403);
    const starts = await Promise.all([call(`/rooms/${room.roomId}/start`, players[0].cookie, 'POST'), call(`/rooms/${room.roomId}/start`, players[0].cookie, 'POST')]);
    assert.equal(starts.filter(response => response.status === 201).length, 1);
    assert.equal(await db.round.count({ where: { roomId: room.roomId } }), 1);
    await waitFor(() => feeds.every(feed => !!feed.state.last?.prompt));
    for (const feed of feeds) {
      assert.deepEqual(feed.state.last!.prompt, feeds[0].state.last!.prompt);
      assert.deepEqual(Object.keys(feed.state.last!.prompt!).sort(), ['endsAt', 'referenceEdges', 'roundId', 'startsAt']);
      assert.equal(feed.state.last!.publication?.status, 'pending');
    }
  });
  const prompt = feeds[0].state.last!.prompt!;
  const geometry = (await db.challenge.findUniqueOrThrow({ where: { id: CHALLENGE_ID } })).geometry as unknown as Challenge;
  const drawing = { inputVersion: 1, strokes: geometry.edges.filter(edge => edge.role === 'target').map(edge => ({ points: edge.points })) };
  await t.test('disconnect/reconnect retains the round, private accepted drawing and common official ranking', async () => {
    await setTimeout(Math.max(0, Date.parse(prompt.startsAt) - Date.now()) + 10);
    assert.equal((await call(`/rounds/${prompt.roundId}/submission`, participating[0].cookie, 'POST', drawing)).status, 201);
    feeds[0].socket.close();
    await setTimeout(100);
    const recovered = live(participating[0]);
    feeds[0] = recovered;
    await waitFor(() => !!recovered.state.last?.prompt);
    assert.equal(recovered.state.last!.prompt!.roundId, prompt.roundId);
    assert.equal((await call(`/rounds/${prompt.roundId}/submission`, participating[0].cookie, 'POST', drawing)).status, 409);
    await db.round.update({ where: { id: prompt.roundId }, data: { endsAt: new Date(Date.now() - 1) } });
    await new Scoring(app.get(Database)).processOne();
    await waitFor(() => feeds.every(feed => feed.state.last?.publication?.status === 'complete'));
    const publication = feeds[0].state.last!.publication!;
    assert.equal(publication.status, 'complete');
    if (publication.status !== 'complete') return;
    assert.equal(publication.result.players.length, 4);
    assert.equal(publication.result.players[0].score, 100);
    assert.equal(publication.participants.filter(p => p.timedOut).length, 3);
    for (const feed of feeds) assert.deepEqual(feed.state.last!.publication, publication);
  });
  await t.test('nonmember WebSockets and expired/logout sessions are rejected', async () => {
    const rejected = new WebSocket(`${base.replace('http:', 'ws:')}/api/events?roomId=${room.roomId}`, { headers: { Cookie: excluded.cookie, Origin: origin } });
    sockets.push(rejected);
    const denied = await new Promise<number>(resolve => { rejected.on('unexpected-response', (_req, response) => { response.resume(); resolve(response.statusCode ?? 0); rejected.terminate(); }); rejected.on('error', () => undefined); });
    assert.equal(denied, 403);
    const ended = new Promise<number>(resolve => feeds[0].socket.once('close', code => resolve(code)));
    await call('/auth/logout', participating[0].cookie, 'POST');
    assert.equal(await ended, 1008);
  });
  await t.test('authentication endpoints limit repeated attempts', async () => {
    const responses = [];
    for (const index of Array.from({ length: 21 }, (_, i) => i)) {
      responses.push((await call('/auth/login', '', 'POST', {})).status);
      if (responses[index] === 429) break;
    }
    assert.ok(responses.includes(429));
  });
});
