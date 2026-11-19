import type { Cell } from "./grid";

export const gridPresets = {
  "single-cube": [[0, 0, 0]],
  "row-x": [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]],
  "row-y": [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 3, 0]],
  "row-z": [[0, 0, 0], [0, 0, 1], [0, 0, 2], [0, 0, 3]],
  "stack-four": [[0, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, 1]],
  "stack-missing-corner": [[0, 0, 0], [0, 1, 0], [0, 0, 1]],
  "subdivided-cube": [
    [0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1],
    [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1],
  ],
} as const satisfies Readonly<Record<string, readonly Cell[]>>;
