import type { ChallengeCreationResult, EdgeRole, Point, ProjectedEdge, Vector3 } from "../../../srcs/core/game-engine";
import { visiblePerspectiveSegments, type Face, type Segment } from "./perspective";

export type Cell = readonly [number, number, number];
export type GridDraft = {
  readonly challengeId: string;
  readonly cells: readonly Cell[];
  readonly yaw: number;
  readonly pitch: number;
  readonly distance: number;
  readonly fieldOfView: number;
  readonly material: "opaque" | "transparent";
  readonly faceCrosses: boolean;
  readonly hitTolerance: number;
};

const epsilon = 1e-9;
const axes = [0, 1, 2] as const;
const sides = [0, 1] as const;
const subtract = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const vector = ([x, y, z]: Cell): Vector3 => ({ x, y, z });
const key = (p: Vector3): string => `${p.x},${p.y},${p.z}`;

export function compileGridChallenge(draft: GridDraft): ChallengeCreationResult {
  const { cells, yaw, pitch, distance, fieldOfView, hitTolerance } = draft;
  if (!draft.challengeId || !cells.length || !cells.every((cell) => cell.every(Number.isSafeInteger)) ||
      ![yaw, pitch, distance, fieldOfView, hitTolerance].every(Number.isFinite) ||
      Math.abs(pitch) >= 89 || distance <= 0 || fieldOfView <= 0 || fieldOfView >= 179 || hitTolerance <= 0) {
    return { ok: false, error: "invalid_input" };
  }
  const occupied = new Map(cells.map((cell) => [key(vector(cell)), cell]));
  if (occupied.size !== cells.length) return { ok: false, error: "invalid_input" };

  const centerOn = (axis: 0 | 1 | 2): number => {
    const values = cells.map((cell) => cell[axis]);
    return (Math.min(...values) + Math.max(...values) + 1) / 2;
  };
  const center = { x: centerOn(0), y: centerOn(1), z: centerOn(2) };
  const radians = Math.PI / 180;
  const azimuth = yaw * radians;
  const elevation = pitch * radians;
  const direction: Cell = [Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth)];
  const eye = { x: center.x + distance * direction[0], y: center.y + distance * direction[1], z: center.z + distance * direction[2] };
  const forward = { x: -direction[0], y: -direction[1], z: -direction[2] };
  const right = { x: Math.sin(azimuth), y: 0, z: -Math.cos(azimuth) };
  const up = { x: -Math.sin(elevation) * Math.cos(azimuth), y: Math.cos(elevation), z: -Math.sin(elevation) * Math.sin(azimuth) };
  const scale = 2 * Math.tan(fieldOfView * radians / 2);
  const project = (point: Vector3): Point | undefined => {
    const offset = subtract(point, eye);
    const depth = dot(offset, forward);
    if (depth <= epsilon) return undefined;
    const x = 0.5 + dot(offset, right) / (scale * depth);
    const y = 0.5 - dot(offset, up) / (scale * depth);
    return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : undefined;
  };

  // Select one facing direction, as for the nearest face of the original cube.
  const frontAxis = axes.reduce((best, axis) => Math.abs(direction[axis]) > Math.abs(direction[best]) ? axis : best);
  const frontSide = direction[frontAxis] > 0 ? 1 : 0;
  const edges = new Map<string, Segment>();
  const reference = new Set<string>();
  const exterior: Face[] = [];
  const addEdge = (a: Vector3, b: Vector3): string => {
    const first = key(a);
    const second = key(b);
    const id = first < second ? `${first}|${second}` : `${second}|${first}`;
    edges.set(id, first < second ? [a, b] : [b, a]);
    return id;
  };

  for (const id of [...occupied.keys()].sort()) {
    const cell = occupied.get(id);
    if (!cell) continue;
    for (const axis of axes) for (const side of sides) {
      const u = axes[(axis + 1) % 3];
      const v = axes[(axis + 2) % 3];
      const corner = (du: number, dv: number): Vector3 => {
        const point: [number, number, number] = [...cell];
        point[axis] += side;
        point[u] += du;
        point[v] += dv;
        return vector(point);
      };
      const face: Face = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)];
      const boundary = face.map((point, i) => addEdge(point, face[(i + 1) % face.length]));
      const neighbor: [number, number, number] = [...cell];
      neighbor[axis] += side === 1 ? 1 : -1;
      if (occupied.has(key(vector(neighbor)))) continue;
      exterior.push(face);
      const isFront = axis === frontAxis && side === frontSide;
      if (isFront) for (const edge of boundary) reference.add(edge);
      if (draft.faceCrosses) {
        const diagonals = [addEdge(face[0], face[2]), addEdge(face[1], face[3])];
        if (isFront) for (const edge of diagonals) reference.add(edge);
      }
    }
  }

  if ([...edges.values()].some((segment) => segment.some((point) => !project(point)))) {
    return { ok: false, error: "degenerate_geometry" };
  }
  const paths = [...edges.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).flatMap(([id, segment]) => {
    const isReference = reference.has(id);
    const visible = isReference || draft.material === "opaque" ? visiblePerspectiveSegments(eye, segment, exterior) : [segment];
    const path = ([start, end]: Segment, role: EdgeRole, suffix: string): readonly ProjectedEdge[] => {
      const a = project(start);
      const b = project(end);
      if (!a || !b || Math.hypot(a.x - b.x, a.y - b.y) <= epsilon) return [];
      return [{ id: `${id}:${suffix}`, role, points: [a, b] }];
    };
    const shown = visible.flatMap((piece, i) => path(piece, isReference ? "reference" : "target", String(i)));
    if (!isReference || draft.material === "opaque") return shown;

    // Keep the same prompt in transparent mode. Only the portions not already
    // given as reference become additional targets.
    const ends = [segment[0], ...visible.flat(), segment[1]];
    const rear = Array.from({ length: visible.length + 1 }, (_, i) =>
      path([ends[2 * i], ends[2 * i + 1]], "target", `rear-${i}`)).flat();
    return [...shown, ...rear];
  });
  if (!paths.some((edge) => edge.role === "reference")) return { ok: false, error: "degenerate_geometry" };
  if (!paths.some((edge) => edge.role === "target")) return { ok: false, error: "no_target" };
  return { ok: true, challenge: {
    challengeVersion: 2, challengeId: draft.challengeId, projection: "perspective",
    referenceFaceId: `${"xyz"[frontAxis]}:${frontSide}`, edges: paths, hitTolerance, completionThreshold: 0.8,
  } };
}
