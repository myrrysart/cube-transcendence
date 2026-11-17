import type { Challenge, GameResult } from './game-engine';

export type Account = { readonly id: string; readonly label: string };
export type RoundPrompt = {
  readonly roundId: string; readonly startsAt: string; readonly endsAt: string;
  readonly referenceEdges: readonly { readonly points: Challenge['edges'][number]['points'] }[];
};
export type Publication = { readonly status: 'pending' } | {
  readonly status: 'complete'; readonly challenge: Challenge; readonly result: GameResult;
  readonly participants: readonly { readonly participantId: string; readonly userId: string; readonly label: string; readonly timedOut: boolean }[];
};
export type RoomView = {
  readonly roomId: string; readonly hostId: string;
  readonly members: readonly { readonly userId: string; readonly label: string; readonly ready: boolean; readonly connected: boolean }[];
  readonly prompt: RoundPrompt | null; readonly publication: Publication | null;
};
