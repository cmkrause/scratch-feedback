import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmationLeft } from "../ui.js";
import { isComplete, rowScore } from "../core.js";
test("confirmation aligns first left, intermediate center, and last right", () => {
  assert.equal(confirmationLeft(0, 52, 110, 400, 0, 4), 0);
  assert.equal(confirmationLeft(60, 52, 110, 400, 1, 4), 31);
  assert.equal(confirmationLeft(180, 52, 110, 400, 3, 4), 122);
});
test("confirmation stays inside narrow containers and wrapped rows", () => {
  assert.equal(confirmationLeft(0, 48, 110, 300, 5, 6), 0);
  assert.equal(confirmationLeft(270, 48, 110, 300, 4, 6), 190);
});
test("all questions must find their key; zero-point completion counts", () => {
  const c = { answers: [1, 3], points: [6, 2, 1, 0] };
  assert.equal(isComplete(c, [[], []]), false);
  assert.equal(isComplete(c, [[1], [0]]), false);
  assert.equal(isComplete(c, [[1]]), false);
  const attempts = [[1], [0, 1, 2, 3]];
  assert.equal(rowScore(c, attempts, 1), 0);
  assert.equal(isComplete(c, attempts), true);
});

test("PDF export also rejects an incomplete activity", async () => {
  const { exportPDF } = await import("../export.js");
  await assert.rejects(
    exportPDF({
      c: {
        version: 1,
        title: "Incomplete",
        description: "",
        startNumber: 1,
        choiceCount: 2,
        points: [2, 0],
        answers: [1],
      },
      attempts: [[]],
    }),
    /Complete every question/,
  );
});
