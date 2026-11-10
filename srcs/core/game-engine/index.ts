export type Point = { readonly x: number; readonly y: number };
export type Vector3 = { readonly x: number; readonly y: number; readonly z: number };
export type Stroke = { readonly points: readonly Point[] };
export type FinalDrawing = { readonly inputVersion: 1; readonly strokes: readonly Stroke[] };
export type EdgeRole = "reference" | "target" | "hidden";
export type ProjectionKind = "orthographic" | "perspective" | "curvilinear_fisheye";
export type ProjectedEdge = { readonly id: string; readonly role: EdgeRole; readonly points: readonly Point[] };
export type Challenge = { readonly challengeVersion: 2; readonly challengeId: string; readonly projection: ProjectionKind; readonly referenceFaceId: string; readonly edges: readonly ProjectedEdge[]; readonly hitTolerance: number; readonly completionThreshold: 0.8 };
export type CreatorDraft = { readonly sourceVersion: 1; readonly challengeId: string; readonly cube: { readonly cubeId: string; readonly center: Vector3; readonly size: number; readonly rotationDegrees: Vector3 }; readonly camera: { readonly orbitDegrees: { readonly yaw: number; readonly pitch: number }; readonly distance: number; readonly fieldOfViewDegrees: number; readonly projection: ProjectionKind }; readonly referenceFaceId: string; readonly roles: Readonly<Record<string, EdgeRole>>; readonly hitTolerance: number };
export type SavedChallenge = { readonly draft: CreatorDraft; readonly challenge: Challenge };
export type ChallengeCreationError = "invalid_input" | "degenerate_geometry" | "invalid_roles" | "no_target";
export type ChallengeCreationResult = { readonly ok: true; readonly challenge: Challenge } | { readonly ok: false; readonly error: ChallengeCreationError };
export type RoundEntry = { readonly participantId: string; readonly drawing: FinalDrawing; readonly elapsedMs: number };
export type GameInput = { readonly inputVersion: 1; readonly challenge: Challenge; readonly entries: readonly RoundEntry[] };
export type PointOutcome = "on_target" | "off_target";
export type StrokeFeedback = { readonly outcomes: readonly PointOutcome[] };
export type TargetCompletion = { readonly edgeId: string; readonly coverage: number; readonly meetsThreshold: boolean };
export type EnginePlayerResult = RoundEntry & { readonly rank: number; readonly score: number; readonly feedback: { readonly strokes: readonly StrokeFeedback[]; readonly targets: readonly TargetCompletion[] } };
export type GameResult = { readonly outputVersion: 1; readonly players: readonly EnginePlayerResult[] };

const edgeIds = ["x:0:0", "x:0:1", "x:1:0", "x:1:1", "y:0:0", "y:0:1", "y:1:0", "y:1:1", "z:0:0", "z:0:1", "z:1:0", "z:1:1"] as const;
const faceBoundary: Readonly<Record<string, readonly string[]>> = {
  "x:0": ["y:0:0", "y:1:0", "z:0:0", "z:1:0"], "x:1": ["y:0:1", "y:1:1", "z:0:1", "z:1:1"],
  "y:0": ["x:0:0", "x:1:0", "z:0:0", "z:0:1"], "y:1": ["x:0:1", "x:1:1", "z:1:0", "z:1:1"],
  "z:0": ["x:0:0", "x:1:0", "y:0:0", "y:1:0"], "z:1": ["x:0:1", "x:1:1", "y:0:1", "y:1:1"],
};
const faceNormals: Readonly<Record<string, Vector3>> = {
  "x:0": { x: -1, y: 0, z: 0 }, "x:1": { x: 1, y: 0, z: 0 },
  "y:0": { x: 0, y: -1, z: 0 }, "y:1": { x: 0, y: 1, z: 0 },
  "z:0": { x: 0, y: 0, z: -1 }, "z:1": { x: 0, y: 0, z: 1 },
};
const faceIds = Object.keys(faceBoundary);
const finite = (value: number): boolean => Number.isFinite(value);
const add = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (value: Vector3, amount: number): Vector3 => ({ x: value.x * amount, y: value.y * amount, z: value.z * amount });
const dot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vector3, b: Vector3): Vector3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const normalize = (value: Vector3): Vector3 => scale(value, 1 / Math.hypot(value.x, value.y, value.z));
const rotate = (point: Vector3, rotation: Vector3): Vector3 => {
  const radians = Math.PI / 180;
  const yaw = rotation.y * radians;
  const pitch = rotation.x * radians;
  const roll = rotation.z * radians;
  const yawed = { x: Math.cos(yaw) * point.x + Math.sin(yaw) * point.z, y: point.y, z: -Math.sin(yaw) * point.x + Math.cos(yaw) * point.z };
  const pitched = { x: yawed.x, y: Math.cos(pitch) * yawed.y - Math.sin(pitch) * yawed.z, z: Math.sin(pitch) * yawed.y + Math.cos(pitch) * yawed.z };
  return { x: Math.cos(roll) * pitched.x - Math.sin(roll) * pitched.y, y: Math.sin(roll) * pitched.x + Math.cos(roll) * pitched.y, z: pitched.z };
};
export const closestReferenceFace = (draft: CreatorDraft): string => {
  const radians = Math.PI / 180;
  const yaw = draft.camera.orbitDegrees.yaw * radians;
  const pitch = draft.camera.orbitDegrees.pitch * radians;
  const cameraDirection = { x: Math.cos(pitch) * Math.cos(yaw), y: Math.sin(pitch), z: Math.cos(pitch) * Math.sin(yaw) };
  return faceIds.reduce((closest, faceId) => {
    const normal = rotate(faceNormals[faceId], draft.cube.rotationDegrees);
    const closestNormal = rotate(faceNormals[closest], draft.cube.rotationDegrees);
    return dot(normal, cameraDirection) > dot(closestNormal, cameraDirection) ? faceId : closest;
  }, faceIds[0] as string);
};
const edgeEnds = (v: Record<string, Vector3>): readonly [string, Vector3, Vector3][] => [
  ["x:0:0", v.v000, v.v100], ["x:0:1", v.v010, v.v110], ["x:1:0", v.v001, v.v101], ["x:1:1", v.v011, v.v111],
  ["y:0:0", v.v000, v.v010], ["y:0:1", v.v100, v.v110], ["y:1:0", v.v001, v.v011], ["y:1:1", v.v101, v.v111],
  ["z:0:0", v.v000, v.v001], ["z:0:1", v.v100, v.v101], ["z:1:0", v.v010, v.v011], ["z:1:1", v.v110, v.v111],
];

export const cubeVertices = (cube: CreatorDraft["cube"]): readonly Vector3[] => {
  const halfSize = cube.size / 2;
  const vertex = (x: number, y: number, z: number): Vector3 => add(cube.center, rotate({ x: x * halfSize, y: y * halfSize, z: z * halfSize }, cube.rotationDegrees));
  return [vertex(-1, -1, -1), vertex(1, -1, -1), vertex(-1, 1, -1), vertex(1, 1, -1), vertex(-1, -1, 1), vertex(1, -1, 1), vertex(-1, 1, 1), vertex(1, 1, 1)];
};

export const compileChallenge = (draft: CreatorDraft): ChallengeCreationResult => {
  const numericValues = [draft.cube.center.x, draft.cube.center.y, draft.cube.center.z, draft.cube.size, draft.cube.rotationDegrees.x, draft.cube.rotationDegrees.y, draft.cube.rotationDegrees.z, draft.camera.distance, draft.camera.fieldOfViewDegrees, draft.camera.orbitDegrees.yaw, draft.camera.orbitDegrees.pitch, draft.hitTolerance];
  const camera = draft.camera;
   if (draft.sourceVersion !== 1 || !draft.challengeId || !draft.cube.cubeId || !numericValues.every(finite) || draft.cube.size <= 0 || camera.distance <= 0 || draft.hitTolerance <= 0 || camera.fieldOfViewDegrees <= 0 || camera.fieldOfViewDegrees >= 179 || camera.orbitDegrees.pitch <= -89 || camera.orbitDegrees.pitch >= 89 || !Object.hasOwn(faceBoundary, draft.referenceFaceId) || draft.referenceFaceId !== closestReferenceFace(draft)) return { ok: false, error: "invalid_input" };
  if (!edgeIds.every((id) => draft.roles[id] !== undefined) || Object.keys(draft.roles).some((id) => !edgeIds.includes(id as typeof edgeIds[number]))) return { ok: false, error: "invalid_roles" };
  if (Object.values(draft.roles).some((role) => !["reference", "target", "hidden"].includes(role))) return { ok: false, error: "invalid_roles" };
  const boundaryIds = faceBoundary[draft.referenceFaceId];
  if (boundaryIds.some((id) => draft.roles[id] !== "reference")) return { ok: false, error: "invalid_roles" };
  if (!edgeIds.some((id) => draft.roles[id] === "target")) return { ok: false, error: "no_target" };

   const [v000, v100, v010, v110, v001, v101, v011, v111] = cubeVertices(draft.cube);
   const vertices = { v000, v100, v010, v110, v001, v101, v011, v111 };
  const radians = Math.PI / 180;
  const yaw = camera.orbitDegrees.yaw * radians;
  const pitch = camera.orbitDegrees.pitch * radians;
  const forward = normalize(scale({ x: Math.cos(pitch) * Math.cos(yaw), y: Math.sin(pitch), z: Math.cos(pitch) * Math.sin(yaw) }, -1));
  const cameraPosition = add(draft.cube.center, scale(forward, -camera.distance));
  const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = cross(right, forward);
  const fov = camera.fieldOfViewDegrees * radians;
  const project = (point: Vector3): Point | undefined => {
    const relative = { x: point.x - cameraPosition.x, y: point.y - cameraPosition.y, z: point.z - cameraPosition.z };
    const depth = dot(relative, forward);
    const horizontal = dot(relative, right);
    const vertical = dot(relative, up);
    if (!finite(depth) || depth <= 1e-8) return undefined;
    if (camera.projection === "orthographic") { const size = camera.distance * Math.tan(fov / 2); return { x: 0.5 + horizontal / (2 * size), y: 0.5 - vertical / (2 * size) }; }
    if (camera.projection === "perspective") { const scaleFactor = 2 * depth * Math.tan(fov / 2); return { x: 0.5 + horizontal / scaleFactor, y: 0.5 - vertical / scaleFactor }; }
    const angle = Math.atan2(Math.hypot(horizontal, vertical), depth);
    if (angle > fov / 2) return undefined;
    const radius = angle / (fov / 2);
    const directionLength = Math.hypot(horizontal, vertical) || 1;
    return { x: 0.5 + horizontal / directionLength * radius / 2, y: 0.5 - vertical / directionLength * radius / 2 };
  };
   const edges = edgeEnds(vertices).map(([id, start, end]) => {
     const samples = camera.projection === "curvilinear_fisheye"
       ? Array.from({ length: 17 }, (_, index) => project(add(start, scale(add(end, scale(start, -1)), index / 16))))
       : [project(start), project(end)];
     const points = samples.filter((point): point is Point => point !== undefined);
     if (samples.some((point) => point === undefined)) return { id, role: draft.roles[id], points: [] };
     return { id, role: draft.roles[id], points };
   });
  if (edges.some((edge) => edge.points.length < 2 || edge.points.some((point) => !finite(point.x) || !finite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1))) return { ok: false, error: "degenerate_geometry" };
   return { ok: true, challenge: { challengeVersion: 2, challengeId: draft.challengeId, projection: camera.projection, referenceFaceId: draft.referenceFaceId, edges, hitTolerance: draft.hitTolerance, completionThreshold: 0.8 } };
};

export const createChallenge = compileChallenge;
const distance = (point: Point, start: Point, end: Point): number => { const dx = end.x - start.x; const dy = end.y - start.y; const length = dx * dx + dy * dy; const t = length ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length)) : 0; return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy); };
export const evaluateGame = (input: GameInput): GameResult => {
  const evaluated = input.entries.map((entry) => {
    const drawingSegments = entry.drawing.strokes.flatMap((stroke) => stroke.points.map((point, index) => [point, stroke.points[index + 1] ?? point] as const));
    const nearDrawing = (point: Point): boolean => drawingSegments.some(([start, end]) => distance(point, start, end) <= input.challenge.hitTolerance);
    const targetEdges = input.challenge.edges.filter((edge) => edge.role === "target");
    const strokes = entry.drawing.strokes.map((stroke) => ({ outcomes: stroke.points.map((point): PointOutcome => targetEdges.some((edge) => edge.points.slice(1).some((end, index) => { const start = edge.points[index]; return start !== undefined && distance(point, start, end) <= input.challenge.hitTolerance; })) ? "on_target" : "off_target") }));
    const outcomes = strokes.flatMap((stroke) => stroke.outcomes);
    const coverages = targetEdges.map((edge) => {
      const lengths = edge.points.slice(1).map((end, index) => { const start = edge.points[index]; return start === undefined ? 0 : Math.hypot(end.x - start.x, end.y - start.y); });
      const total = lengths.reduce((sum, length) => sum + length, 0);
      const samples = Array.from({ length: 100 }, (_, sampleIndex) => {
        const wanted = total * sampleIndex / 99;
        let traversed = 0;
        for (let index = 0; index < lengths.length; index += 1) {
          const length = lengths[index];
          if (wanted <= traversed + length || index === lengths.length - 1) {
            const start = edge.points[index]; const end = edge.points[index + 1] ?? start;
            if (!start || !end) return false;
            const ratio = length ? (wanted - traversed) / length : 0;
            return nearDrawing({ x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio });
          }
          traversed += length;
        }
        return false;
      });
      return samples.filter(Boolean).length / 100;
    });
    const targets = targetEdges.map((edge, index) => ({ edgeId: edge.id, coverage: coverages[index] ?? 0, meetsThreshold: (coverages[index] ?? 0) >= input.challenge.completionThreshold }));
    const multiplier = coverages.length ? coverages.reduce((sum, coverage) => sum + Math.min(coverage / input.challenge.completionThreshold, 1), 0) / coverages.length : 0;
    const pointAccuracy = outcomes.length ? outcomes.filter((outcome) => outcome === "on_target").length / outcomes.length : 0;
    const score = 100 * pointAccuracy * multiplier;
    return { ...entry, rank: 0, score, feedback: { strokes, targets } };
  });
  const sorted = [...evaluated].sort((a, b) => b.score - a.score || a.elapsedMs - b.elapsedMs);
  return { outputVersion: 1, players: sorted.map((player, index) => ({ ...player, rank: sorted.findIndex((other) => other.score === player.score && other.elapsedMs === player.elapsedMs) + 1 || index + 1 })) };
};
