import { Injectable } from '@nestjs/common';
import type { RoomView } from '../../core/protocol';
import { Database } from './database';
import { CHALLENGE_ID, ROUND_DURATION_MS, Rounds, type Outcome } from './rounds';

@Injectable()
export class Rooms {
  constructor(private readonly db: Database, private readonly rounds: Rounds) {}

  async create(userId: string): Promise<Outcome<RoomView>> {
    const room = await this.db.room.create({ data: { hostId: userId, members: { create: { userId } } } });
    return this.view(room.id, userId);
  }

  async join(roomId: string, userId: string): Promise<Outcome<RoomView>> {
    const joined: Outcome<null> = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${roomId}::uuid FOR UPDATE`;
      const room = await tx.room.findUnique({ where: { id: roomId }, include: { members: true, activeRound: { include: { result: true } } } });
      if (!room) return { ok: false, error: 'not_found' };
      if (room.members.some(member => member.userId === userId)) return { ok: true, data: null };
      if (room.activeRound && !room.activeRound.result) return { ok: false, error: 'closed' };
      if (room.members.length >= 4) return { ok: false, error: 'full' };
      await tx.roomParticipant.create({ data: { roomId, userId } });
      return { ok: true, data: null };
    });
    if (!joined.ok) return joined;
    return this.view(roomId, userId);
  }

  async ready(roomId: string, userId: string, ready: boolean): Promise<Outcome<RoomView>> {
    const updated: Outcome<null> = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${roomId}::uuid FOR UPDATE`;
      const room = await tx.room.findUnique({ where: { id: roomId }, include: { activeRound: { include: { result: true } } } });
      const member = await tx.roomParticipant.findUnique({ where: { roomId_userId: { roomId, userId } } });
      if (!room || !member) return { ok: false, error: 'not_found' };
      if (room.activeRound && !room.activeRound.result) return { ok: false, error: 'closed' };
      await tx.roomParticipant.update({ where: { roomId_userId: { roomId, userId } }, data: { ready } });
      return { ok: true, data: null };
    });
    if (!updated.ok) return updated;
    return this.view(roomId, userId);
  }

  async start(roomId: string, userId: string): Promise<Outcome<RoomView>> {
    const started: Outcome<null> = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${roomId}::uuid FOR UPDATE`;
      const room = await tx.room.findUnique({ where: { id: roomId }, include: { members: true, activeRound: { include: { result: true } } } });
      if (!room || !room.members.some(member => member.userId === userId)) return { ok: false, error: 'not_found' };
      if (room.hostId !== userId) return { ok: false, error: 'not_host' };
      if (room.activeRound && !room.activeRound.result) return { ok: false, error: 'closed' };
      if (!room.members.length || !room.members.every(member => member.ready)) return { ok: false, error: 'not_ready' };
      if (!await tx.challenge.findUnique({ where: { id: CHALLENGE_ID } })) return { ok: false, error: 'challenge_unavailable' };
      const startsAt = new Date(Date.now() + 1500);
      const round = await tx.round.create({ data: {
        roomId, challengeId: CHALLENGE_ID, startsAt, endsAt: new Date(startsAt.getTime() + ROUND_DURATION_MS),
        participants: { create: room.members.map(member => ({ userId: member.userId })) }, job: { create: {} },
      } });
      await tx.room.update({ where: { id: roomId }, data: { activeRoundId: round.id } });
      await tx.roomParticipant.updateMany({ where: { roomId }, data: { ready: false } });
      return { ok: true, data: null };
    });
    if (!started.ok) return started;
    return this.view(roomId, userId);
  }

  async leave(roomId: string, userId: string): Promise<Outcome<{ readonly left: true }>> {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${roomId}::uuid FOR UPDATE`;
      const room = await tx.room.findUnique({ where: { id: roomId }, include: { members: { orderBy: { userId: 'asc' } } } });
      if (!room || !room.members.some(member => member.userId === userId)) return { ok: false, error: 'not_found' };
      await tx.roomParticipant.delete({ where: { roomId_userId: { roomId, userId } } });
      const successor = room.members.find(member => member.userId !== userId);
      if (room.hostId === userId && successor) await tx.room.update({ where: { id: roomId }, data: { hostId: successor.userId } });
      return { ok: true, data: { left: true } };
    });
  }

  async view(roomId: string, userId: string): Promise<Outcome<RoomView>> {
    const room = await this.db.room.findFirst({ where: { id: roomId, members: { some: { userId } } }, include: { members: { include: { user: true }, orderBy: { userId: 'asc' } }, activeRound: { include: { participants: true } } } });
    if (!room) return { ok: false, error: 'not_found' };
    const participant = room.activeRound?.participants.some(p => p.userId === userId);
    const prompt = participant && room.activeRound ? await this.rounds.get(room.activeRound.id, userId) : null;
    const publication = participant && room.activeRound ? await this.rounds.result(room.activeRound.id, userId) : null;
    return { ok: true, data: {
      roomId: room.id, hostId: room.hostId,
      members: room.members.map(member => ({ userId: member.userId, label: member.user.label, ready: member.ready, connected: !!member.lastSeenAt && Date.now() - member.lastSeenAt.getTime() < 30000 })),
      prompt: prompt?.ok ? prompt.data : null, publication: publication?.ok ? publication.data : null,
    } };
  }
}
