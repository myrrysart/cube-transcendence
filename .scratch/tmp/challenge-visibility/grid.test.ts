import { describe, expect, test } from "bun:test";
import { evaluateGame } from "../../../srcs/core/game-engine";
import { compileGridChallenge, type GridDraft } from "./grid";
import { gridPresets } from "./presets";

const twoCubes = [[0, 0, 0], [0, 0, 1]] as const;
const base: GridDraft = {
  challengeId: "grid-test", cells: twoCubes, yaw: 29, pitch: 21, distance: 6, fieldOfView: 60,
  material: "opaque", faceCrosses: false, hitTolerance: 0.01,
};
const compile = (changes: Partial<GridDraft> = {}) => {
  const result = compileGridChallenge({ ...base, ...changes });
  if (!result.ok) throw new Error(result.error);
  return result.challenge;
};
const outline = (challenge: ReturnType<typeof compile>) => challenge.edges.filter((edge) => edge.role === "reference");

describe("perspective grid challenges", () => {
  test("single cube: front outline and five visible target edges at a three-face view", () => {
    const opaque = compile({ cells: gridPresets["single-cube"], distance: 4 });
    expect(outline(opaque)).toHaveLength(4);
    expect(opaque.edges.filter((edge) => edge.role === "target")).toHaveLength(5);
    expect(opaque.edges.filter((edge) => edge.id.startsWith("0,0,0|"))).toHaveLength(0);
  });

  test("two cubes: the front seam appears once in the prompt and the top seam stays a target", () => {
    const opaque = compile();
    const transparent = compile({ material: "transparent" });
    const frontSeam = "1,0,1|1,1,1:0";
    const topSeam = "0,1,1|1,1,1:0";
    const rearSeam = "0,0,1|0,1,1:0";
    expect(outline(opaque)).toHaveLength(7);
    expect(outline(transparent)).toEqual(outline(opaque));
    for (const challenge of [opaque, transparent]) {
      expect(challenge.edges.filter((edge) => edge.id === frontSeam).map((edge) => edge.role)).toEqual(["reference"]);
      expect(challenge.edges.find((edge) => edge.id === topSeam)?.role).toBe("target");
    }
    expect(opaque.edges.some((edge) => edge.id === rearSeam)).toBe(false);
    expect(transparent.edges.find((edge) => edge.id === rearSeam)?.role).toBe("target");
  });

  test("a stepped row scores the exposed fragment rather than the full rear edge", () => {
    const cells = [[0, 0, 0], [1, 0, 1]] as const;
    const opaque = compile({ cells });
    const transparent = compile({ cells, material: "transparent" });
    const edgeId = "0,0,1|0,1,1:0";
    const clipped = opaque.edges.find((edge) => edge.id === edgeId);
    const full = transparent.edges.find((edge) => edge.id === edgeId);
    expect(clipped?.role).toBe("target");
    expect(full?.role).toBe("target");
    expect(clipped?.points[1]).toEqual(full?.points[1]);
    expect(clipped?.points[0].y).toBeLessThan(full?.points[0].y ?? 0);
    expect(outline(transparent)).toEqual(outline(opaque));
    expect(transparent.edges.find((edge) => edge.id === "1,0,0|1,0,1:rear-1")?.role).toBe("target");
  });

  test("Xs are added to exterior faces only, including rear faces in transparent mode", () => {
    const opaque = compile({ faceCrosses: true });
    const transparent = compile({ faceCrosses: true, material: "transparent" });
    const front = "1,0,0|1,1,1:0";
    const outer = "0,0,0|0,1,1:0";
    const buried = "0,0,1|1,1,1:0";
    expect(opaque.edges.find((edge) => edge.id === front)?.role).toBe("reference");
    expect(outline(transparent)).toEqual(outline(opaque));
    expect(opaque.edges.some((edge) => edge.id === outer)).toBe(false);
    expect(transparent.edges.find((edge) => edge.id === outer)?.role).toBe("target");
    expect(transparent.edges.some((edge) => edge.id === buried)).toBe(false);
    expect(transparent.edges.length - compile({ material: "transparent" }).edges.length).toBe(20);
  });

  test("a subdivided cube shows internal grid segments and exterior Xs on its reference face", () => {
    const cells = gridPresets["subdivided-cube"];
    const plain = compile({ cells });
    const crossed = compile({ cells, faceCrosses: true });
    const middle = outline(plain).filter((edge) => edge.id.includes("2,1,1"));
    expect(outline(plain)).toHaveLength(12);
    expect(middle).toHaveLength(4);
    expect(outline(crossed)).toHaveLength(20);
  });

  test("every preset compiles deterministically and a target trace scores 100", () => {
    for (const cells of Object.values(gridPresets)) for (const material of ["opaque", "transparent"] as const) {
      const challenge = compile({ cells, material, faceCrosses: true });
      expect(compile({ cells: [...cells].reverse(), material, faceCrosses: true })).toEqual(challenge);
      const targets = challenge.edges.filter((edge) => edge.role === "target");
      const result = evaluateGame({ inputVersion: 1, challenge, entries: [{
        participantId: "trace", elapsedMs: 1,
        drawing: { inputVersion: 1, strokes: targets.map(({ points }) => ({ points })) },
      }] });
      expect(result.players[0].score).toBe(100);
    }
  });

  test("rejects duplicate cells and scenes that cannot fit the canvas", () => {
    expect(compileGridChallenge({ ...base, cells: [twoCubes[0], twoCubes[0]] })).toEqual({ ok: false, error: "invalid_input" });
    expect(compileGridChallenge({ ...base, fieldOfView: 1 })).toEqual({ ok: false, error: "degenerate_geometry" });
  });
});
