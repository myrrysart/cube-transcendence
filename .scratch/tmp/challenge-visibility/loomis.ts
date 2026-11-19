import type { ChallengeCreationResult, Point, ProjectedEdge, Vector3 } from "../../../srcs/core/game-engine";

export type LoomisDraft = {
  readonly shape: "loomis-head";
  readonly challengeId: string;
  readonly yaw: number;
  readonly pitch: number;
};
type LoomisResult = Extract<ChallengeCreationResult, { ok: false }> | {
  readonly ok: true;
  readonly challenge: Extract<ChallengeCreationResult, { ok: true }>["challenge"];
  readonly guides: readonly { readonly id: string; readonly points: readonly Point[] }[];
};

const radians = Math.PI / 180;
const cut = 0.74;
const distance = 4.4;
const dot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const point = (x: number, y: number, z: number): Vector3 => ({ x, y, z });
const cross = (a: Vector3, b: Vector3): Vector3 => point(
  a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x,
);

export function compileLoomisHead(draft: LoomisDraft): LoomisResult {
  if (!draft.challengeId || ![draft.yaw, draft.pitch].every(Number.isFinite) || Math.abs(draft.yaw) > 60 || Math.abs(draft.pitch) > 30) {
    return { ok: false, error: "invalid_input" };
  }
  const yaw = draft.yaw * radians;
  const pitch = draft.pitch * radians;
  const towardEye = point(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const right = point(Math.cos(yaw), 0, -Math.sin(yaw));
  const up = point(-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw) * Math.sin(pitch));
  const center = point(0, 0.29, 0);
  const project = (p: Vector3): Point => {
    const scale = (distance - dot(towardEye, p)) * 0.92;
    return { x: 0.5 + dot(right, p) / scale, y: 0.5 - dot(up, p) / scale };
  };
  const path = (id: string, role: ProjectedEdge["role"], points: readonly Vector3[]): ProjectedEdge => ({
    id, role, points: points.map(project),
  });
  const chin = point(0, -1.18, 0.72);
  const belowNose = point(0, -0.44, 0.91);
  const brows = [point(-0.47, 0.08, 0.82), point(0.47, 0.08, 0.82)] as const;
  const reference = [
    path("brow-span", "reference", brows),
    path("left-to-nose-base", "reference", [brows[0], belowNose]),
    path("right-to-nose-base", "reference", [brows[1], belowNose]),
  ];

  // A perspective sphere's silhouette is a tangent circle on the sphere,
  // shifted toward the eye. Keep the upper arc between the two temples.
  const eyeFromSphere = point(distance * towardEye.x, distance * towardEye.y - center.y, distance * towardEye.z);
  const eyeDistance = Math.hypot(eyeFromSphere.x, eyeFromSphere.y, eyeFromSphere.z);
  const normal = point(eyeFromSphere.x / eyeDistance, eyeFromSphere.y / eyeDistance, eyeFromSphere.z / eyeDistance);
  // right is orthogonal to eyeFromSphere; normal × right points up.
  const arcUp = cross(normal, right);
  const radius = Math.sqrt(1 - 1 / eyeDistance ** 2);
  const tangent = (angle: number): Vector3 => {
    const horizontal = radius * Math.cos(angle);
    const vertical = radius * Math.sin(angle);
    return point(normal.x / eyeDistance + horizontal * right.x + vertical * arcUp.x,
      normal.y / eyeDistance + vertical * arcUp.y,
      normal.z / eyeDistance + horizontal * right.z + vertical * arcUp.z);
  };
  const world = (p: Vector3): Vector3 => point(p.x, p.y + center.y, p.z);
  const rimRadius = Math.sqrt(1 - cut ** 2);
  const projectedCenter = project(center);
  const visibleSide = Math.abs(eyeFromSphere.x) > cut + 0.1 ? Math.sign(eyeFromSphere.x) : 0;
  const coveredByRim = (p: Vector3): boolean => visibleSide * p.x > cut;

  // If a tangent point is beyond a cut, its radial sight plane meets the rim
  // instead. Pick the farther-out intersection in the picture, not in 3D.
  const silhouette = (p: Vector3): Vector3 => {
    if (Math.abs(p.x) <= cut) return world(p);
    const x = Math.sign(p.x) * cut;
    const plane = cross(eyeFromSphere, p);
    const across = Math.hypot(plane.y, plane.z);
    const uy = plane.y / across;
    const uz = plane.z / across;
    const offset = -plane.x * x / across;
    const halfChord = Math.sqrt(Math.max(0, rimRadius ** 2 - offset ** 2));
    const a = world(point(x, offset * uy - halfChord * uz, offset * uz + halfChord * uy));
    const b = world(point(x, offset * uy + halfChord * uz, offset * uz - halfChord * uy));
    const sky = project(world(p));
    const along = (end: Vector3): number => {
      const q = project(end);
      return (q.x - projectedCenter.x) * (sky.x - projectedCenter.x) + (q.y - projectedCenter.y) * (sky.y - projectedCenter.y);
    };
    return along(a) >= along(b) ? a : b;
  };

  // The exposed ellipse already supplies its rim. Stop/restart the cranial
  // path at the sphere/rim intersection instead of scoring that rim twice.
  const steps = 64;
  const angles = Array.from({ length: steps + 1 }, (_, i) => Math.PI * i / steps);
  const craniumPieces: Vector3[][] = [];
  angles.forEach((angle, i) => {
    const p = tangent(angle);
    const skipped = coveredByRim(p);
    const previous = i > 0 ? angles[i - 1] : angle;
    const wasSkipped = coveredByRim(tangent(previous));
    if (!skipped && (i === 0 || wasSkipped)) craniumPieces.push([]);
    if (wasSkipped !== skipped) {
      let lo = previous;
      let hi = angle;
      for (let n = 0; n < 24; n += 1) {
        const mid = (lo + hi) / 2;
        if (coveredByRim(tangent(mid)) === wasSkipped) lo = mid;
        else hi = mid;
      }
      const join = tangent((lo + hi) / 2);
      craniumPieces.at(-1)?.push(world(point(visibleSide * cut, join.y, join.z)));
    }
    if (!skipped) craniumPieces.at(-1)?.push(silhouette(p));
  });
  const [rightTemple, leftTemple] = [silhouette(tangent(0)), silhouette(tangent(Math.PI))];
  // Build the mandible off the lower side plane, not the cranium's widest
  // point. Its rear angle sits below the cut before turning toward the chin.
  const hingeAngle = Math.PI * 0.88;
  const rimPoint = (side: number, angle: number): Vector3 =>
    world(point(side * cut, rimRadius * Math.cos(angle), rimRadius * Math.sin(angle)));
  const jawSide = (side: number, temple: Vector3): readonly Vector3[] => {
    if (side === visibleSide) return [rimPoint(side, hingeAngle), point(side * 0.66, -0.68, 0.22)];
    return [temple, browCorner(side), cheekCorner(side)];
  };
  const browCorner = (side: number) => point(side * 0.56, 0.08, 0.92);
  const cheekCorner = (side: number) => point(side * 0.49, -0.55, 0.89);
  const targets = [
    ...craniumPieces.map((arc, i) => path(i === 0 ? "cranium-arc" : `cranium-arc-${i + 1}`, "target", arc)),
    path("jaw-contour", "target", [
      ...jawSide(-1, leftTemple), chin, ...[...jawSide(1, rightTemple)].reverse(),
    ]),
  ];

  // At near-frontal views the flattened side plane is edge-on or facing away.
  if (visibleSide) {
    const angles = [...Array.from({ length: steps + 1 }, (_, i) => 2 * Math.PI * i / steps), hingeAngle].sort((a, b) => a - b);
    const ellipse = angles.map((angle) => rimPoint(visibleSide, angle === 2 * Math.PI ? 0 : angle));
    targets.push(path("side-plane", "target", ellipse));
  }

  const edges = [...reference, ...targets];
  if (edges.some((edge) => edge.points.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1))) {
    return { ok: false, error: "degenerate_geometry" };
  }
  // Sparse construction marks rather than finished features. The outer ends of
  // the brows sit on the prompt anchors; the nose mark ends at the triangle tip.
  const guides = ([-1, 1] as const).flatMap((side) => {
    const feature = (x: number, y: number, z: number) => point(side * x, y, z);
    const name = side < 0 ? "left" : "right";
    return [
      { id: `${name}-brow`, points: [brows[side < 0 ? 0 : 1], feature(0.35, 0.145, 0.88), feature(0.17, 0.11, 0.91)].map(project) },
      { id: `${name}-eye`, points: [feature(0.445, -0.085, 0.83), feature(0.33, -0.028, 0.9), feature(0.21, -0.047, 0.93), feature(0.125, -0.103, 0.947)].map(project) },
    ];
  });
  guides.push(
    { id: "nose", points: [point(0, -0.30, 0.99), point(0, -0.393, 1.006), belowNose].map(project) },
    { id: "mouth", points: [point(-0.20, -0.675, 0.84), point(-0.07, -0.661, 0.9), point(0, -0.68, 0.915),
      point(0.07, -0.661, 0.9), point(0.20, -0.675, 0.84)].map(project) },
  );
  return {
    ok: true, guides, challenge: {
      challengeVersion: 2, challengeId: draft.challengeId, projection: "perspective",
      referenceFaceId: "face-triangle", edges, hitTolerance: 0.018, completionThreshold: 0.8,
    },
  };
}
