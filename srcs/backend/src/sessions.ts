import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { SessionKind } from '@prisma/client';
import { Database } from './database';

const digest = (token: string): string => createHash('sha256').update(token).digest('hex');
const cookieToken = (cookie: string | undefined): string | undefined => cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('cube_session='))?.slice(13);

@Injectable()
export class Sessions {
  constructor(private readonly db: Database) {}

  async createGuest(): Promise<string> {
    const user = await this.db.user.create({ data: { label: 'Guest' } });
    return this.issue(user.id, 'guest');
  }

  async issue(userId: string, kind: SessionKind): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.db.session.create({ data: {
      tokenHash: digest(token), userId, kind, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    } });
    return token;
  }

  async identify(cookie: string | undefined): Promise<string | null> {
    const token = cookieToken(cookie);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const session = await this.db.session.findUnique({ where: { tokenHash: digest(token) } });
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    if (session.kind === 'guest' && (process.env.ENABLE_DEV_SESSION !== 'true' || process.env.NODE_ENV === 'production')) return null;
    return session.userId;
  }

  async revoke(cookie: string | undefined): Promise<void> {
    const token = cookieToken(cookie);
    if (token) await this.db.session.deleteMany({ where: { tokenHash: digest(token) } });
  }
}
