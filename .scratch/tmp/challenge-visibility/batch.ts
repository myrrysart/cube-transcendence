import type { Challenge, Point, ProjectedEdge } from "../../../srcs/core/game-engine";
import { compileGridChallenge, type GridDraft } from "./grid";
import { compileLoomisHead, type LoomisDraft } from "./loomis";
import { gridPresets } from "./presets";

type Preset = keyof typeof gridPresets;
type Material = GridDraft["material"];
export type BatchSettings = {
  readonly preset: Preset | "all" | "loomis-head";
  readonly material: Material | "both";
  readonly crosses: "off" | "on" | "both";
  readonly views: 3 | 6 | 12 | 40;
};
export type BatchRecord = {
  readonly draft: GridDraft | LoomisDraft;
  readonly challenge: Challenge;
};
export type Inspection = {
  readonly record: BatchRecord;
  readonly warnings: readonly string[];
  readonly guides?: readonly { readonly id: string; readonly points: readonly Point[] }[];
};

export const presetNames = Object.keys(gridPresets) as Preset[];
export const viewCounts = [3, 6, 12, 40] as const;
export const defaultBatch: BatchSettings = { preset: "all", material: "both", crosses: "off", views: 40 };

const views = [
  [29, 21], [63, 23], [147, 26], [28, -24], [119, 25], [235, 24],
  [320, 27], [202, -24], [58, -17], [141, -20], [225, -22], [310, -19],
  ...[18, 54, 108, 162, 198, 252, 306].flatMap((yaw) =>
    [-31, -13, 14, 34].map((pitch) => [yaw, pitch] as const)),
] as const;
const materials = ["opaque", "transparent"] as const;
const loomisViews = [
  [0, 0], [-35, 0], [35, 0], [0, -15], [0, 15], [-48, -12], [48, 12], [-24, 18], [24, -18],
  ...[-55, -42, -31, -17, 0, 17, 31, 42, 55].flatMap((yaw) =>
    [-24, -8, 9, 23].map((pitch) => [yaw, pitch] as const)),
] as const;

function segmentsOverlap(start: Point, end: Point, first: Point, last: Point): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return false;
  const onLine = ({ x, y }: typeof start) => Math.abs(dx * (y - start.y) - dy * (x - start.x)) / length < 1e-6;
  if (!onLine(first) || !onLine(last)) return false;
  const along = ({ x, y }: typeof start) => (dx * (x - start.x) + dy * (y - start.y)) / length;
  const p = along(first);
  const q = along(last);
  return Math.min(Math.max(p, q), length) - Math.max(Math.min(p, q), 0) > 1e-6;
}

function overlaps(a: ProjectedEdge, b: ProjectedEdge): boolean {
  return a.points.slice(1).some((end, i) => b.points.slice(1).some((last, j) =>
    segmentsOverlap(a.points[i], end, b.points[j], last)));
}

function inspect(record: BatchRecord): Inspection {
  const refs = record.challenge.edges.filter((edge) => edge.role === "reference");
  const targets = record.challenge.edges.filter((edge) => edge.role === "target");
  const short = ({ points }: ProjectedEdge) => points.slice(1).reduce((sum, p, i) =>
    sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0) < 0.025;
  const warnings = [
    ...(targets.some(short) ? ["Short target"] : []),
    ...(targets.some((target) => refs.some((ref) => overlaps(target, ref))) ? ["Target overlaps prompt"] : []),
    ...(targets.some((target, i) => targets.slice(i + 1).some((other) => overlaps(target, other))) ? ["Targets overlap"] : []),
  ];
  return { record, warnings };
}

export function generateBatch(settings: BatchSettings): { readonly entries: readonly Inspection[]; readonly rejected: readonly string[] } {
  const entries: Inspection[] = [];
  const rejected: string[] = [];
  if (settings.preset === "loomis-head") {
    for (const [yaw, pitch] of loomisViews.slice(0, settings.views)) {
      const challengeId = `loomis-r4-${yaw}-${pitch}`;
      const draft: LoomisDraft = { shape: "loomis-head", challengeId, yaw, pitch };
      const result = compileLoomisHead(draft);
      if (result.ok) entries.push({ ...inspect({ draft, challenge: result.challenge }), guides: result.guides });
      else rejected.push(`${challengeId}: ${result.error}`);
    }
    return { entries, rejected };
  }
  const presets = settings.preset === "all" ? presetNames : [settings.preset];
  const modes = settings.material === "both" ? materials : [settings.material];
  const crosses = settings.crosses === "both" ? [false, true] : [settings.crosses === "on"];
  for (const preset of presets) for (const material of modes) for (const faceCrosses of crosses) {
    for (const [yaw, pitch] of views.slice(0, settings.views)) {
      const challengeId = `grid-r2-${preset}-${material}-${faceCrosses ? "crosses" : "plain"}-${yaw}-${pitch}`;
      const draft: GridDraft = {
        challengeId, cells: gridPresets[preset], yaw, pitch, material, faceCrosses,
        distance: preset === "single-cube" ? 3.5 : 5.5, fieldOfView: 55, hitTolerance: 0.018,
      };
      const result = compileGridChallenge(draft);
      if (!result.ok) {
        rejected.push(`${challengeId}: ${result.error}`);
        continue;
      }
      entries.push(inspect({ draft, challenge: result.challenge }));
    }
  }
  return { entries, rejected };
}

export function exportApproved(entries: readonly Inspection[], approved: ReadonlySet<string>): string {
  return JSON.stringify({
    batchVersion: 1,
    records: entries.filter(({ record }) => approved.has(record.challenge.challengeId)).map(({ record }) => record),
  }, null, 2);
}
