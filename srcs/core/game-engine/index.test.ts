import { describe, expect, test } from "bun:test";
import { closestReferenceFace, compileChallenge, cubeVertices, evaluateGame, type CreatorDraft, type Challenge } from "./index";

const edgeIds = ["x:0:0", "x:0:1", "x:1:0", "x:1:1", "y:0:0", "y:0:1", "y:1:0", "y:1:1", "z:0:0", "z:0:1", "z:1:0", "z:1:1"] as const;
const boundary: Record<string, readonly string[]> = {
  "x:0": ["y:0:0", "y:1:0", "z:0:0", "z:1:0"], "x:1": ["y:0:1", "y:1:1", "z:0:1", "z:1:1"],
  "y:0": ["x:0:0", "x:1:0", "z:0:0", "z:0:1"], "y:1": ["x:0:1", "x:1:1", "z:1:0", "z:1:1"],
  "z:0": ["x:0:0", "x:1:0", "y:0:0", "y:1:0"], "z:1": ["x:0:1", "x:1:1", "y:0:1", "y:1:1"],
};
const draft = (projection: CreatorDraft["camera"]["projection"] = "orthographic", face = "x:1"): CreatorDraft => ({
  sourceVersion: 1, challengeId: "test", cube: { cubeId: "cube", center: { x: 0, y: 0, z: 0 }, size: 1, rotationDegrees: { x: 0, y: 0, z: 0 } },
  camera: { orbitDegrees: { yaw: 35, pitch: 15 }, distance: 4, fieldOfViewDegrees: 70, projection }, referenceFaceId: face,
  roles: Object.fromEntries(edgeIds.map((id) => [id, boundary[face].includes(id) ? "reference" : "target"])) as CreatorDraft["roles"], hitTolerance: 0.01,
});
const compile = (d = draft()) => { const result = compileChallenge(d); expect(result.ok).toBe(true); if (!result.ok) throw new Error(result.error); return result.challenge; };
const drawing = (challenge: Challenge, edgeId: string, pointIndex = 0) => { const path = challenge.edges.find((edge) => edge.id === edgeId)?.points; if (!path) throw new Error("missing path"); return { inputVersion: 1 as const, strokes: [{ points: [path[pointIndex]] }] }; };

describe("compileChallenge", () => {
  test("selects the camera-nearest face, including rotation and orbit changes", () => {
    expect(closestReferenceFace(draft())).toBe("x:1");
    expect(closestReferenceFace({ ...draft(), cube: { ...draft().cube, rotationDegrees: { x: 0, y: 180, z: 0 } } })).toBe("x:0");
    expect(closestReferenceFace({ ...draft(), camera: { ...draft().camera, orbitDegrees: { yaw: 180, pitch: 15 } } })).toBe("x:0");
  });
  test("rejects a far-side reference face", () => {
    expect(compileChallenge({ ...draft(), referenceFaceId: "x:0", roles: Object.fromEntries(edgeIds.map((id) => [id, boundary["x:0"].includes(id) ? "reference" : "target"])) as CreatorDraft["roles"] }).ok).toBe(false);
  });
  test("emits twelve stable paths and canonical reference boundaries", () => {
    const challenge = compile();
    expect(challenge.challengeVersion).toBe(2);
    expect(challenge.completionThreshold).toBe(0.8);
    expect(challenge.edges.map((edge) => edge.id)).toEqual(Array.from(edgeIds));
    expect(challenge.edges.filter((edge) => edge.role === "reference").map((edge) => edge.id).sort()).toEqual([...boundary["x:1"]].sort());
  });
  test("is deterministic and produces finite in-canvas paths", () => {
    const a = compile(draft("perspective"));
    expect(compile(draft("perspective"))).toEqual(a);
    expect(a.edges.every((edge) => edge.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1))).toBe(true);
  });
  test("orthographic paths sharing an axis remain parallel", () => {
    const challenge = compile(); const x = challenge.edges.filter((edge) => edge.id.startsWith("x:"));
    const direction = (edge: typeof x[number]) => ({ x: edge.points[1].x - edge.points[0].x, y: edge.points[1].y - edge.points[0].y });
    const a = direction(x[0]); const b = direction(x[1]); expect(a.x * b.y - a.y * b.x).toBeCloseTo(0);
  });
  test("rotated cube keeps equal edges and perpendicular incident axes", () => {
    const vertices = cubeVertices({ ...draft().cube, rotationDegrees: { x: 23, y: 37, z: 19 } });
    const pairs = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
    const vectors = pairs.map(([a, b]) => ({ x: vertices[b].x - vertices[a].x, y: vertices[b].y - vertices[a].y, z: vertices[b].z - vertices[a].z }));
    const length = (v: typeof vectors[number]) => Math.hypot(v.x, v.y, v.z);
    expect(new Set(vectors.map(length).map((value) => value.toFixed(10))).size).toBe(1);
    const incident = [[0, 1], [0, 2], [1, 2]];
    incident.forEach(([a, b]) => expect(vectors[a].x * vectors[b].x + vectors[a].y * vectors[b].y + vectors[a].z * vectors[b].z).toBeCloseTo(0));
  });
  test("center-tracking camera projects cube center to canvas center", () => {
    const challenge = compile(draft("orthographic"));
    const points = challenge.edges.flatMap((edge) => edge.points);
    expect(points.reduce((sum, point) => sum + point.x, 0) / points.length).toBeCloseTo(0.5);
    expect(points.reduce((sum, point) => sum + point.y, 0) / points.length).toBeCloseTo(0.5);
  });
  test("fisheye samples curves and preserves genuine three-edge topology", () => {
    const challenge = compile(draft("curvilinear_fisheye"));
    expect(challenge.edges.some((edge) => edge.points.length > 2)).toBe(true);
    const vertices = challenge.edges.flatMap((edge) => {
      const first = edge.points[0];
      const last = edge.points[edge.points.length - 1];
      return first !== undefined && last !== undefined ? [first, last] : [];
    });
    const counts = vertices.map((point) => vertices.filter((other) => other.x === point.x && other.y === point.y).length);
    expect(counts.every((count) => count === 3)).toBe(true);
  });
  test("rejects fisheye edges with unprojectable samples", () => {
    expect(compileChallenge({ ...draft("curvilinear_fisheye"), camera: { ...draft("curvilinear_fisheye").camera, fieldOfViewDegrees: 20 } }).ok).toBe(false);
  });
  test("rejects malformed numeric, role, face, and target inputs", () => {
    expect(compileChallenge({ ...draft(), cube: { ...draft().cube, rotationDegrees: { x: Number.NaN, y: 0, z: 0 } } }).ok).toBe(false);
    expect(compileChallenge({ ...draft(), referenceFaceId: "q:0" }).ok).toBe(false);
    expect(compileChallenge({ ...draft(), roles: { ...draft().roles, "y:0:1": "target" } }).ok).toBe(false);
    expect(compileChallenge({ ...draft(), roles: Object.fromEntries(edgeIds.map((id) => [id, "hidden"])) }).ok).toBe(false);
  });
});

describe("evaluateGame", () => {
  test("scores path interior, joint, inclusive tolerance, and excludes reference/hidden", () => {
    const challenge = compile(); const target = challenge.edges.find((edge) => edge.role === "target")!; const hidden = { ...target, role: "hidden" as const, points: [{ x: 0.1, y: 0.9 }, { x: 0.2, y: 0.9 }] };
    const reference = challenge.edges.find((edge) => edge.role === "reference")!;
    const tested = { ...challenge, edges: [...challenge.edges.map((edge) => edge === target ? edge : edge === reference ? edge : ({ ...edge, role: "hidden" as const })), hidden] };
    const points = [target.points[0], target.points[1], { x: (target.points[0].x + target.points[1].x) / 2, y: (target.points[0].y + target.points[1].y) / 2 + challenge.hitTolerance }, { x: 0.1, y: 0.9 }, hidden.points[0]];
    const result = evaluateGame({ inputVersion: 1, challenge: tested, entries: [{ participantId: "p", elapsedMs: 1, drawing: { inputVersion: 1, strokes: [{ points }] } }] });
    expect(result.players[0].feedback.strokes[0].outcomes).toEqual(["on_target", "on_target", "on_target", "off_target", "off_target"]);
  });
  test("preserves feedback shape, scores, ordering, ranks, and input", () => {
    const challenge = compile();
    const onTarget = challenge.edges.find((edge) => edge.role === "target")!.points[0];
    const input = { inputVersion: 1 as const, challenge, entries: [
      { participantId: "slow", elapsedMs: 20, drawing: { inputVersion: 1 as const, strokes: [{ points: [onTarget, { x: 0, y: 0 }] }] } },
      { participantId: "fast", elapsedMs: 10, drawing: { inputVersion: 1 as const, strokes: [{ points: [onTarget] }] } },
      { participantId: "tie", elapsedMs: 10, drawing: { inputVersion: 1 as const, strokes: [{ points: [onTarget] }] } },
      { participantId: "empty", elapsedMs: 1, drawing: { inputVersion: 1 as const, strokes: [] } },
    ] };
    const before = structuredClone(input);
    const result = evaluateGame(input);
    expect(result.players.map((player) => player.participantId)).toEqual(["slow", "fast", "tie", "empty"]);
    expect(result.players.map((player) => player.rank)).toEqual([1, 2, 2, 4]);
    expect(result.players[0].feedback.strokes[0].outcomes).toEqual(["on_target", "off_target"]);
    expect(result.players[3].feedback.strokes).toEqual([]);
    expect(input).toEqual(before);
  });

  test("a one-point dab scores below a fully covered target", () => {
    const challenge = { ...compile(), edges: compile().edges.filter((edge) => edge.role === "target").map((edge) => edge.id === "x:0:0" ? edge : { ...edge, role: "hidden" as const }) };
    const target = challenge.edges.find((edge) => edge.role === "target");
    if (!target) throw new Error("missing target");
    const dab = { inputVersion: 1 as const, strokes: [{ points: [target.points[0]] }] };
    const complete = { inputVersion: 1 as const, strokes: [{ points: target.points }] };
    const result = evaluateGame({ inputVersion: 1, challenge, entries: [{ participantId: "dab", drawing: dab, elapsedMs: 1 }, { participantId: "complete", drawing: complete, elapsedMs: 2 }] });
    expect(result.players[0].participantId).toBe("complete");
    expect(result.players[1].score).toBeLessThan(result.players[0].score);
  });

  test("full coverage avoids completion penalties", () => {
    const challenge = compile();
    const strokes = challenge.edges.filter((edge) => edge.role === "target").map((edge) => ({ points: edge.points }));
    const result = evaluateGame({ inputVersion: 1, challenge, entries: [{ participantId: "p", elapsedMs: 1, drawing: { inputVersion: 1, strokes } }] });
    expect(result.players[0].score).toBe(100);
    expect(result.players[0].feedback.targets.every((target) => target.coverage === 1 && target.meetsThreshold)).toBe(true);
  });

  test("multiple curved target coverages are deterministic", () => {
    const challenge = compile(draft("curvilinear_fisheye"));
    const drawing = { inputVersion: 1 as const, strokes: challenge.edges.filter((edge) => edge.role === "target").map((edge) => ({ points: edge.points })) };
    const input = { inputVersion: 1 as const, challenge, entries: [{ participantId: "p", elapsedMs: 1, drawing }] };
    expect(evaluateGame(input).players[0].feedback.targets).toEqual(evaluateGame(input).players[0].feedback.targets);
  });
});
