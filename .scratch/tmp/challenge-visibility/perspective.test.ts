import { describe, expect, test } from "bun:test";
import { visiblePerspectiveSegments, type Face, type Segment } from "./perspective";

const point = (x: number, y: number, z: number) => ({ x, y, z });
const eye = point(0, 0, 0);
const face = (left: number, right: number, bottom: number, top: number, z: number): Face => [
  point(left, bottom, z), point(right, bottom, z), point(right, top, z), point(left, top, z),
];

describe("perspective visibility fixtures", () => {
  test("one cube: the front face hides a rear edge but not its own outline", () => {
    const front = face(-1, 1, -1, 1, 3);
    const frontEdge: Segment = [front[0], front[1]];
    const rearEdge: Segment = [point(-1, -1, 5), point(1, -1, 5)];

    expect(visiblePerspectiveSegments(eye, frontEdge, [front])).toEqual([frontEdge]);
    expect(visiblePerspectiveSegments(eye, rearEdge, [front])).toEqual([]);
  });

  test("two touching cubes: their coplanar seam remains visible across both faces", () => {
    const faces = [face(1, 3, -2, 0, 4), face(1, 3, 0, 2, 4)];
    const seam: Segment = [point(1, 0, 4), point(3, 0, 4)];

    expect(visiblePerspectiveSegments(eye, seam, faces)).toEqual([seam]);
  });

  test("a nearer cube clips only the blocked part of a seam; transparent keeps it all", () => {
    const left = face(1, 3, -2, 0, 4);
    const right = face(1, 3, 0, 2, 4);
    const blocker = face(-1, 1, -1, 1, 2);
    const seam: Segment = [point(1, 0, 4), point(3, 0, 4)];

    // Ray through the blocker at (1, 0, 2) reaches the seam at (2, 0, 4).
    expect(visiblePerspectiveSegments(eye, seam, [left, right, blocker])).toEqual([
      [point(2, 0, 4), point(3, 0, 4)],
    ]);
    expect(visiblePerspectiveSegments(eye, seam, [])).toEqual([seam]);
  });

  test("a middle blocker yields two paths instead of scoring a bridge through the gap", () => {
    const blocker = face(-1, 1, -1, 1, 2);
    const line: Segment = [point(-4, 0, 4), point(4, 0, 4)];

    expect(visiblePerspectiveSegments(eye, line, [blocker])).toEqual([
      [point(-4, 0, 4), point(-2, 0, 4)],
      [point(2, 0, 4), point(4, 0, 4)],
    ]);
  });

  test("a face with the same projection behind a line cannot occlude it", () => {
    const faceBehind = face(-2, 2, -2, 2, 4);
    const line: Segment = [point(-1, 0, 2), point(1, 0, 2)];

    expect(visiblePerspectiveSegments(eye, line, [faceBehind])).toEqual([line]);
  });

  test("a tilted face leaves its own X visible but blocks a rear line", () => {
    const tilted: Face = [point(-1, -1, 2), point(1, -1, 4), point(1, 1, 4), point(-1, 1, 2)];
    const diagonal: Segment = [tilted[0], tilted[2]];
    const rear: Segment = [point(-1, 0, 6), point(1, 0, 6)];
    const reversed: Face = [tilted[3], tilted[2], tilted[1], tilted[0]];

    expect(visiblePerspectiveSegments(eye, diagonal, [tilted])).toEqual([diagonal]);
    expect(visiblePerspectiveSegments(eye, rear, [tilted])).toEqual([]);
    expect(visiblePerspectiveSegments(eye, rear, [reversed])).toEqual([]);
  });
});
