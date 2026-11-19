import { expect, test } from "bun:test";
import { evaluateGame } from "../../../srcs/core/game-engine";
import { defaultBatch, exportApproved, generateBatch } from "./batch";
import { compileLoomisHead } from "./loomis";

test("40 Loomis views have distinct geometry, only a triangle prompt, and score a perfect trace", () => {
  const settings = { ...defaultBatch, preset: "loomis-head" } as const;
  const batch = generateBatch(settings);
  expect(batch.rejected).toEqual([]);
  expect(batch.entries).toHaveLength(40);
  expect(batch.entries).toEqual(generateBatch(settings).entries);
  expect(new Set(batch.entries.map(({ record }) => JSON.stringify(record.challenge.edges))).size).toBe(40);

  for (const { record: { challenge, draft } } of batch.entries) {
    const refs = challenge.edges.filter((edge) => edge.role === "reference");
    const [brow, left, right] = refs;
    expect(challenge.referenceFaceId).toBe("face-triangle");
    expect(refs.map(({ id }) => id)).toEqual(["brow-span", "left-to-nose-base", "right-to-nose-base"]);
    expect([left.points[0], right.points[0]]).toEqual([...brow.points]);
    expect(left.points[1]).toEqual(right.points[1]);
    const [a, b] = brow.points;
    const noseBase = left.points[1];
    expect(Math.abs((b.x - a.x) * (noseBase.y - a.y) - (b.y - a.y) * (noseBase.x - a.x))).toBeGreaterThan(0.01);

    const targets = challenge.edges.filter((edge) => edge.role === "target");
    expect(targets[0].id).toBe("cranium-arc");
    const jaw = targets.find((edge) => edge.id === "jaw-contour");
    expect(jaw).toBeDefined();
    expect(Math.max(...(jaw?.points ?? []).map(({ y }) => y))).toBeGreaterThan(noseBase.y + 0.05);
    const side = targets.find((edge) => edge.id === "side-plane");
    expect(Boolean(side)).toBe(Math.abs(draft.yaw) >= 17);
    if (side) expect(side.points[0]).toEqual(side.points[side.points.length - 1]);
    const score = evaluateGame({ inputVersion: 1, challenge, entries: [
      { participantId: "answer", elapsedMs: 1, drawing: { inputVersion: 1, strokes: targets.map(({ points }) => ({ points })) } },
      { participantId: "prompt", elapsedMs: 1, drawing: { inputVersion: 1, strokes: refs.map(({ points }) => ({ points })) } },
    ] });
    expect(score.players[0].score).toBe(100);
    expect(score.players[1].score).toBeLessThan(100);
  }
  const selected = batch.entries[0].record;
  expect(JSON.parse(exportApproved(batch.entries, new Set([selected.challenge.challengeId])))).toEqual({
    batchVersion: 1, records: [selected],
  });
});

test("the reported 17°/23° pose and its mirror end the skull arc at the side rim", () => {
  for (const yaw of [17, -17]) {
    const result = compileLoomisHead({ shape: "loomis-head", challengeId: "rim-test", yaw, pitch: 23 });
    if (!result.ok) throw new Error(result.error);
    const arc = result.challenge.edges.find(({ id }) => id === "cranium-arc");
    const rim = result.challenge.edges.find(({ id }) => id === "side-plane");
    if (!arc || !rim) throw new Error("Expected a cranium arc and a side rim.");
    const sign = Math.sign(yaw);
    const outerX = Math.max(...rim.points.map(({ x }) => sign * x));
    expect(Math.max(...arc.points.map(({ x }) => sign * x))).toBeLessThan(outerX + 0.0002);
    const end = yaw > 0 ? arc.points[0] : arc.points[arc.points.length - 1];
    expect(Math.min(...rim.points.map(({ x, y }) => Math.hypot(x - end.x, y - end.y)))).toBeLessThan(0.009);
  }
});

test("the facial contour encloses all three prompt edges, including the reported -55°/9° view", () => {
  const { entries } = generateBatch({ ...defaultBatch, preset: "loomis-head" });
  for (const { record: { challenge } } of entries) {
    const targets = challenge.edges.filter(({ role }) => role === "target");
    for (const { points: [start, end] } of challenge.edges.filter(({ role }) => role === "reference")) {
      for (let i = 0; i <= 10; i += 1) {
        const x = start.x + (end.x - start.x) * i / 10;
        const y = start.y + (end.y - start.y) * i / 10;
        const crossings = targets.flatMap(({ points }) => points.slice(1).flatMap((b, j) => {
          const a = points[j];
          return (a.y > y) === (b.y > y) ? [] : [a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y)];
        }));
        const margin = Math.min(x - Math.min(...crossings), Math.max(...crossings) - x);
        if (margin <= 0.005) throw new Error(`Prompt meets or crosses the silhouette in ${challenge.challengeId}.`);
      }
    }
  }
});

test("the jaw attaches to the lower side rim without crossing the side plane", () => {
  const { entries } = generateBatch({ ...defaultBatch, preset: "loomis-head" });
  for (const { record: { challenge, draft } } of entries) {
    const rim = challenge.edges.find(({ id }) => id === "side-plane");
    if (!rim) continue;
    const jaw = challenge.edges.find(({ id }) => id === "jaw-contour");
    if (!jaw) throw new Error("Expected a jaw contour.");
    const hinge = draft.yaw < 0 ? jaw.points[0] : jaw.points[jaw.points.length - 1];
    expect(rim.points).toContainEqual(hinge);
    expect(hinge.y).toBeGreaterThan((Math.min(...rim.points.map(({ y }) => y)) + Math.max(...rim.points.map(({ y }) => y))) / 2);

    // A projected circle is convex. Its edge half-planes describe the inside
    // without tying the test to screen pixels or which side is facing us.
    for (const [i, end] of jaw.points.slice(1).entries()) {
      const start = jaw.points[i];
      for (let n = 1; n < 10; n += 1) {
        const t = n / 10;
        const x = start.x + (end.x - start.x) * t;
        const y = start.y + (end.y - start.y) * t;
        const halfPlanes = rim.points.slice(1).map((b, j) => {
          const a = rim.points[j];
          return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
        });
        if (halfPlanes.every((value) => value > 0) || halfPlanes.every((value) => value < 0)) {
          throw new Error(`Jaw crosses the side plane in ${challenge.challengeId}.`);
        }
      }
    }
  }
});

test("Loomis compiler rejects back views and non-finite angles", () => {
  const draft = { shape: "loomis-head", challengeId: "test", yaw: 0, pitch: 0 } as const;
  expect(compileLoomisHead({ ...draft, yaw: 180 })).toEqual({ ok: false, error: "invalid_input" });
  expect(compileLoomisHead({ ...draft, pitch: Number.NaN })).toEqual({ ok: false, error: "invalid_input" });
});

test("manga construction guides anchor to the triangle and stay out of exports", () => {
  const { entries } = generateBatch({ ...defaultBatch, preset: "loomis-head" });
  for (const { record, guides } of entries) {
    if (!guides) throw new Error("Expected facial guides.");
    const [leftBrow, leftEye, rightBrow, rightEye, nose, mouth] = guides;
    const [browSpan, triangleSide] = record.challenge.edges;
    expect(guides.map(({ id }) => id)).toEqual(["left-brow", "left-eye", "right-brow", "right-eye", "nose", "mouth"]);
    expect([leftBrow.points[0], rightBrow.points[0]]).toEqual([...browSpan.points]);
    expect(nose.points[nose.points.length - 1]).toEqual(triangleSide.points[1]);
    expect(mouth.points[2].y).toBeGreaterThan(nose.points[nose.points.length - 1].y);
    expect([leftEye, rightEye].every(({ points }) => points.length === 4)).toBe(true);
    expect(guides.every(({ points }) => points.every(({ x, y }) => x > 0 && x < 1 && y > 0 && y < 1))).toBe(true);
  }
  const selected = entries[0].record;
  const exported = exportApproved(entries, new Set([selected.challenge.challengeId]));
  expect(JSON.parse(exported)).toEqual({ batchVersion: 1, records: [selected] });
  expect(exported).not.toContain("left-eye");
});
