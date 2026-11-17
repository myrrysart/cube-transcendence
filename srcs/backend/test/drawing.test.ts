import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDrawing } from '../src/drawing';

const drawing = (points: readonly unknown[]) => ({ inputVersion: 1, strokes: [{ points }] });

test('accepts empty drawings, empty strokes, one-point strokes, and normalized boundaries', () => {
  for (const value of [{ inputVersion: 1, strokes: [] }, drawing([]), drawing([{ x: 0, y: 1 }])]) {
    assert.equal(validateDrawing(value).ok, true);
  }
});

test('rejects untrusted shapes, extra identity, non-finite and out-of-range coordinates', () => {
  for (const value of [null, [], { inputVersion: 2, strokes: [] },
    { inputVersion: 1, strokes: [], userId: 'forged' },
    drawing([{ x: NaN, y: 0 }]), drawing([{ x: 0, y: Infinity }]),
    drawing([{ x: -0.1, y: 0 }]), drawing([{ x: 0, y: 1.1 }]),
    drawing([{ x: '0', y: 0 }]), drawing([{ x: 0, y: 0, score: 100 }]),
  ]) assert.equal(validateDrawing(value).ok, false);
});

test('enforces stroke, per-stroke, and aggregate point limits independently', () => {
  const point = { x: 0.5, y: 0.5 };
  assert.equal(validateDrawing({ inputVersion: 1, strokes: Array.from({ length: 256 }, () => ({ points: [] })) }).ok, true);
  assert.equal(validateDrawing({ inputVersion: 1, strokes: Array.from({ length: 257 }, () => ({ points: [] })) }).ok, false);
  assert.equal(validateDrawing(drawing(Array.from({ length: 4097 }, () => point))).ok, false);
  const stroke = { points: Array.from({ length: 4096 }, () => point) };
  assert.equal(validateDrawing({ inputVersion: 1, strokes: [stroke, stroke, stroke, stroke] }).ok, true);
  assert.equal(validateDrawing({ inputVersion: 1, strokes: [stroke, stroke, stroke, stroke, { points: [point] }] }).ok, false);
});
