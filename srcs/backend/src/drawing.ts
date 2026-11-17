import type { FinalDrawing } from '../../core/game-engine';

export type DrawingValidation =
  | { readonly ok: true; readonly data: FinalDrawing }
  | { readonly ok: false; readonly error: string };

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function validateDrawing(value: unknown): DrawingValidation {
  if (!record(value) || Object.keys(value).length !== 2 || value.inputVersion !== 1 || !Array.isArray(value.strokes)) {
    return { ok: false, error: 'Expected only inputVersion: 1 and strokes.' };
  }
  if (value.strokes.length > 256) return { ok: false, error: 'At most 256 strokes are allowed.' };
  const pointCounts: number[] = [];
  for (const stroke of value.strokes) {
    if (!record(stroke) || Object.keys(stroke).length !== 1 || !Array.isArray(stroke.points)) {
      return { ok: false, error: 'Each stroke must contain only points.' };
    }
    if (stroke.points.length > 4096) return { ok: false, error: 'At most 4096 points per stroke are allowed.' };
    pointCounts.push(stroke.points.length);
    for (const point of stroke.points) {
      if (!record(point) || Object.keys(point).length !== 2 ||
        typeof point.x !== 'number' || typeof point.y !== 'number' ||
        !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
        point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
        return { ok: false, error: 'Points must contain only finite x/y coordinates between 0 and 1.' };
      }
    }
  }
  if (pointCounts.reduce((sum, count) => sum + count, 0) > 16384) {
    return { ok: false, error: 'At most 16384 points per drawing are allowed.' };
  }
  // The complete untrusted shape has been checked above; inner code receives the engine type.
  return { ok: true, data: value as FinalDrawing };
}
