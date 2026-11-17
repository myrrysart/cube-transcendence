import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { evaluateGame, type Challenge, type FinalDrawing } from '../../core/game-engine';
import { Database } from './database';

@Injectable()
export class Scoring {
  constructor(private readonly db: Database) {}

  async processOne(): Promise<boolean> {
    const claimToken = randomUUID();
    const roundId = await this.db.$transaction(async tx => {
      const candidates = await tx.$queryRaw<readonly { id: string }[]>`
        SELECT r.id FROM "Round" r JOIN "ScoringJob" j ON j."roundId" = r.id
        WHERE r."endsAt" <= NOW() AND
          (j.status = 'pending' OR (j.status = 'running' AND j."leaseUntil" <= NOW()))
        ORDER BY r."endsAt" LIMIT 1 FOR UPDATE OF r SKIP LOCKED`;
      const candidate = candidates[0];
      if (!candidate) return null;
      await tx.scoringJob.update({ where: { roundId: candidate.id }, data: {
        status: 'running', claimToken, leaseUntil: new Date(Date.now() + 30000), attempts: { increment: 1 },
      } });
      return candidate.id;
    });
    if (!roundId) return false;
    const round = await this.db.round.findUniqueOrThrow({ where: { id: roundId }, include: {
      challenge: true, participants: { orderBy: { id: 'asc' }, include: { submission: true } },
    } });
    const result = evaluateGame({ inputVersion: 1, challenge: round.challenge.geometry as unknown as Challenge,
      entries: round.participants.map(p => ({ participantId: p.id,
        drawing: p.submission ? p.submission.drawing as unknown as FinalDrawing : { inputVersion: 1, strokes: [] },
        elapsedMs: (p.submission?.receivedAt ?? round.endsAt).getTime() - round.startsAt.getTime(),
      })) });
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Round" WHERE id = ${roundId}::uuid FOR UPDATE`;
      const job = await tx.scoringJob.findUniqueOrThrow({ where: { roundId } });
      if (job.status !== 'running' || job.claimToken !== claimToken) return;
      await tx.roundResult.create({ data: { roundId, result: result as unknown as Prisma.InputJsonValue } });
      await tx.scoringJob.update({ where: { roundId }, data: { status: 'done', claimToken: null, leaseUntil: null } });
    });
    return true;
  }
}
