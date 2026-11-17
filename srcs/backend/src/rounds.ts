import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Challenge, FinalDrawing, GameResult } from '../../core/game-engine';
import { Database } from './database';

export const CHALLENGE_ID = 'development-cube-v1';
export const ROUND_DURATION_MS = 15000;
export type { RoundPrompt, Publication } from '../../core/protocol';
import type { RoundPrompt, Publication } from '../../core/protocol';
type ErrorCode = 'not_found' | 'duplicate' | 'closed' | 'challenge_unavailable' | 'full' | 'not_ready' | 'not_host';
export type Outcome<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: ErrorCode };

@Injectable()
export class Rounds {
  constructor(private readonly db: Database) {}

  async create(userId: string): Promise<Outcome<RoundPrompt>> {
    const challenge = await this.db.challenge.findUnique({ where: { id: CHALLENGE_ID } });
    if (!challenge) return { ok: false, error: 'challenge_unavailable' };
    const startsAt = new Date();
    const round = await this.db.round.create({ data: {
      challengeId: challenge.id, startsAt, endsAt: new Date(startsAt.getTime() + ROUND_DURATION_MS),
      participants: { create: { userId } }, job: { create: {} },
    } });
    return { ok: true, data: this.prompt(round, challenge.geometry as unknown as Challenge) };
  }

  async get(roundId: string, userId: string): Promise<Outcome<RoundPrompt>> {
    const round = await this.db.round.findFirst({ where: { id: roundId, participants: { some: { userId } } }, include: { challenge: true } });
    if (!round) return { ok: false, error: 'not_found' };
    return { ok: true, data: this.prompt(round, round.challenge.geometry as unknown as Challenge) };
  }

  async submit(roundId: string, userId: string, drawing: FinalDrawing, receivedAt: Date): Promise<Outcome<{ readonly accepted: true }>> {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Round" WHERE id = ${roundId}::uuid FOR UPDATE`;
      const participant = await tx.roundParticipant.findUnique({
        where: { roundId_userId: { roundId, userId } }, include: { round: { include: { job: true } }, submission: true },
      });
      if (!participant) return { ok: false, error: 'not_found' };
      if (participant.submission) return { ok: false, error: 'duplicate' };
      const { round } = participant;
      if (receivedAt < round.startsAt || receivedAt >= round.endsAt || round.job?.status !== 'pending') {
        return { ok: false, error: 'closed' };
      }
      await tx.submission.create({ data: { participantId: participant.id, receivedAt, drawing: drawing as unknown as Prisma.InputJsonValue } });
      return { ok: true, data: { accepted: true } };
    });
  }

  async result(roundId: string, userId: string): Promise<Outcome<Publication>> {
    const round = await this.db.round.findFirst({
      where: { id: roundId, participants: { some: { userId } } },
      include: { challenge: true, result: true, participants: { orderBy: { id: 'asc' }, include: { user: true, submission: true } } },
    });
    if (!round) return { ok: false, error: 'not_found' };
    if (!round.result || new Date() < round.endsAt) return { ok: true, data: { status: 'pending' } };
    return { ok: true, data: {
      status: 'complete', challenge: round.challenge.geometry as unknown as Challenge,
      result: round.result.result as unknown as GameResult,
      participants: round.participants.map(p => ({ participantId: p.id, userId: p.userId, label: p.user.label, timedOut: !p.submission })),
    } };
  }

  private prompt(round: { id: string; startsAt: Date; endsAt: Date }, challenge: Challenge): RoundPrompt {
    return { roundId: round.id, startsAt: round.startsAt.toISOString(), endsAt: round.endsAt.toISOString(),
      referenceEdges: challenge.edges.filter(edge => edge.role === 'reference').map(edge => ({ points: edge.points })) };
  }
}
