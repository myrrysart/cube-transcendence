import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Account } from '../../core/protocol';
import { Database } from './database';
import { Sessions } from './sessions';

type AuthResult = { readonly ok: true; readonly account: Account; readonly token: string } | { readonly ok: false; readonly error: 'busy' | 'invalid' | 'exists' };
export type Credentials = { readonly email: string; readonly password: string; readonly label?: string };
export function validateCredentials(value: unknown, signup: boolean): Credentials | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const keys = signup ? ['email', 'password', 'label'] : ['email', 'password'];
  if (Object.keys(body).length !== keys.length || Object.keys(body).some(key => !keys.includes(key))) return null;
  if (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(body.email)) return null;
  if (typeof body.password !== 'string' || body.password.length < 15 || body.password.length > 128) return null;
  if (signup && (typeof body.label !== 'string' || !/^[\p{L}\p{N} _-]{2,32}$/u.test(body.label.trim()))) return null;
  return { email: body.email.trim().toLowerCase(), password: body.password, ...(signup ? { label: (body.label as string).trim() } : {}) };
}

// Node's asynchronous scrypt, using OWASP's N=2^17, r=8, p=1 profile.
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => {
      if (error) { reject(error); return; }
      resolve(key);
    });
  });
}

@Injectable()
export class Auth {
  constructor(private readonly db: Database, private readonly sessions: Sessions) {}
  private readonly work = { active: 0 };

  private key(password: string, salt: string): Promise<Buffer | null> {
    if (this.work.active >= 2) return Promise.resolve(null);
    this.work.active += 1;
    return derive(password, salt).finally(() => { this.work.active -= 1; });
  }

  async signup(input: Credentials): Promise<AuthResult> {
    const salt = randomBytes(16).toString('hex');
    const key = await this.key(input.password, salt);
    if (!key) return { ok: false, error: 'busy' };
    // createMany + skipDuplicates makes concurrent identical registrations a domain failure.
    const created = await this.db.user.createMany({ data: [{ email: input.email, label: input.label!, passwordHash: `scrypt-v1:${salt}:${key.toString('hex')}` }], skipDuplicates: true });
    if (created.count === 0) return { ok: false, error: 'exists' };
    const user = await this.db.user.findUniqueOrThrow({ where: { email: input.email } });
    return { ok: true, account: { id: user.id, label: user.label }, token: await this.sessions.issue(user.id, 'account') };
  }

  async login(input: Credentials): Promise<AuthResult> {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    const encoded = user?.passwordHash?.split(':');
    // Missing users still perform the same KDF to reduce account-enumeration timing differences.
    const salt = encoded?.[1] ?? '00000000000000000000000000000000';
    const key = await this.key(input.password, salt);
    if (!key) return { ok: false, error: 'busy' };
    const expected = Buffer.from(encoded?.[2] ?? '0'.repeat(128), 'hex');
    if (!user || !encoded || expected.length !== key.length || !timingSafeEqual(expected, key)) return { ok: false, error: 'invalid' };
    return { ok: true, account: { id: user.id, label: user.label }, token: await this.sessions.issue(user.id, 'account') };
  }
}
