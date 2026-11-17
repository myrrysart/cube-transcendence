import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCredentials } from '../src/auth';

test('account boundary normalizes email and accepts only the specified fields', () => {
  assert.deepEqual(validateCredentials({ email: 'Player@Example.test', password: 'long test password 123', label: 'Player One' }, true), { email: 'player@example.test', password: 'long test password 123', label: 'Player One' });
  for (const input of [null, {}, { email: 'bad', password: 'long test password 123' },
    { email: 'a@example.test', password: 'short' },
    { email: 'a@example.test', password: 'long test password 123', userId: 'forged' },
  ]) assert.equal(validateCredentials(input, false), null);
  assert.equal(validateCredentials({ email: 'a@example.test', password: 'long test password 123', label: '<script>' }, true), null);
});
