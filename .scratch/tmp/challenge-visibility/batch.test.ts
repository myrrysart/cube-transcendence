import { expect, test } from "bun:test";
import { defaultBatch, exportApproved, generateBatch } from "./batch";

test("the full matrix yields 1,120 repeatable, independently identifiable candidates", () => {
  const settings = { ...defaultBatch, crosses: "both" } as const;
  const batch = generateBatch(settings);
  const ids = batch.entries.map(({ record }) => record.challenge.challengeId);
  expect(batch.rejected).toEqual([]);
  expect(ids).toHaveLength(1120);
  expect(new Set(ids).size).toBe(ids.length);
  expect(generateBatch(settings)).toEqual(batch);
  expect(batch.entries.some(({ warnings }) => warnings.includes("Short target"))).toBe(true);
});

test("one shape, material and face-X setting still yields 40 distinct playable views", () => {
  const { entries, rejected } = generateBatch({ ...defaultBatch, preset: "single-cube", material: "opaque" });
  expect(rejected).toEqual([]);
  expect(entries).toHaveLength(40);
  expect(new Set(entries.map(({ record }) => JSON.stringify(record.challenge.edges))).size).toBe(40);
});

test("export contains only explicitly approved records with matching draft and geometry IDs", () => {
  const { entries } = generateBatch({ ...defaultBatch, preset: "row-z", material: "transparent", crosses: "on", views: 3 });
  const selected = entries[1].record;
  expect(entries).toHaveLength(3);
  expect(JSON.parse(exportApproved(entries, new Set()))).toEqual({ batchVersion: 1, records: [] });
  expect(JSON.parse(exportApproved(entries, new Set([selected.challenge.challengeId, "not-in-batch"])))).toEqual({
    batchVersion: 1, records: [selected],
  });
  expect(selected.challenge.challengeId).toBe(selected.draft.challengeId);
});
