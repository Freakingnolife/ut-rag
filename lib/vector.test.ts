import { expect, test } from "vitest";
import { cosineSearch } from "./vector";

// 3 rows, dim 2, already unit-normalized
const matrix = new Float32Array([
  1, 0,        // row 0 -> points +x
  0, 1,        // row 1 -> points +y
  0.7071, 0.7071, // row 2 -> 45deg
]);

test("returns indices ranked by cosine to the query", () => {
  const res = cosineSearch(matrix, 2, [1, 0], 3);
  expect(res[0].idx).toBe(0);
  expect(res[0].score).toBeCloseTo(1, 3);
  expect(res[1].idx).toBe(2); // 45deg closer than +y
  expect(res[2].idx).toBe(1);
});

test("respects topN", () => {
  const res = cosineSearch(matrix, 2, [1, 0], 1);
  expect(res).toHaveLength(1);
});
