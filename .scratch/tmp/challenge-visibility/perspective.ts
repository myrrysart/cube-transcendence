import type { Vector3 } from "../../../srcs/core/game-engine";

export type Segment = readonly [Vector3, Vector3];
export type Face = readonly [Vector3, Vector3, Vector3, Vector3];
type Span = readonly [number, number];

const epsilon = 1e-9;
const subtract = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

// Intersect a parameter interval with the region where a linear value is >= 0.
function clip(span: Span, atStart: number, atEnd: number): Span | undefined {
  if (atStart >= 0 && atEnd >= 0) return span;
  if (atStart < 0 && atEnd < 0) return undefined;
  const crossing = atStart / (atStart - atEnd);
  const [start, end] = span;
  const clipped: Span = atStart < 0 ? [Math.max(start, crossing), end] : [start, Math.min(end, crossing)];
  return clipped[1] - clipped[0] > epsilon ? clipped : undefined;
}

// Faces are convex planar quads in perimeter order, entirely in front of the
// camera. The line and faces use the same world coordinates. Topology and edge
// roles are assigned elsewhere: this only answers which portions can be seen.
export function visiblePerspectiveSegments(
  eye: Vector3, segment: Segment, faces: readonly Face[],
): readonly Segment[] {
  const [start, end] = segment.map((point) => subtract(point, eye));
  const visible = faces.reduce<readonly Span[]>((remaining, face) => {
    if (!remaining.length) return remaining;
    const corners = face.map((point) => subtract(point, eye));
    const [a, b, c] = corners;
    const normal = cross(subtract(b, a), subtract(c, a));
    const normalLength = Math.hypot(normal.x, normal.y, normal.z);
    const plane = dot(normal, a);
    if (Math.abs(plane) <= epsilon * normalLength) return remaining;

    // First keep only segment points farther than the face plane. Coplanar
    // lines (e.g. seams and face Xs) must not hide behind their own face.
    const behind = (point: Vector3): number => (dot(normal, point) - plane) * Math.sign(plane) / normalLength;
    const atStart = behind(start);
    const atEnd = behind(end);
    if (Math.max(atStart, atEnd) <= epsilon) return remaining;
    const behindFace = clip([0, 1], atStart, atEnd);

    // Planes from the eye through each quad side bound its projected shadow.
    const covered = corners.reduce<Span | undefined>((span, corner, i) => {
      if (!span) return undefined;
      const side = cross(corner, corners[(i + 1) % corners.length]);
      const inward = Math.sign(dot(side, corners[(i + 2) % corners.length]));
      return clip(span, inward * dot(side, start), inward * dot(side, end));
    }, behindFace);
    if (!covered) return remaining;

    return remaining.flatMap(([lo, hi]): readonly Span[] => {
      const [from, to] = covered;
      if (to <= lo || from >= hi) return [[lo, hi]];
      const left: readonly Span[] = from - lo > epsilon ? [[lo, from]] : [];
      const right: readonly Span[] = hi - to > epsilon ? [[to, hi]] : [];
      return [...left, ...right];
    });
  }, [[0, 1]]);

  const [a, b] = segment;
  const at = (t: number): Vector3 => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  });
  return visible.map(([lo, hi]) => [at(lo), at(hi)]);
}
