import { test } from "node:test";
import assert from "node:assert/strict";
import {
  remainingAnswer,
  revealRemaining,
  restoreAutomaticReveals,
  nextUnfinished,
  rowScore,
  isComplete,
} from "../core.js";
const c = { choiceCount: 4, points: [6, 2, 1, 0], answers: [0, 3, 1] };
test("only the last untried answer is eligible for automatic reveal", () => {
  assert.equal(remainingAnswer(c, [[1, 2], [], []], 0), null);
  assert.equal(remainingAnswer(c, [[1, 2, 3], [], []], 0), 0);
  assert.equal(remainingAnswer(c, [[1, 0, 2], [], []], 0), null);
});
test("automatic completion records the final attempt once and earns last-attempt credit", () => {
  const attempts = [[1, 2, 3], [3], [1]];
  assert.equal(revealRemaining(c, attempts, 0), 0);
  assert.deepEqual(attempts[0], [1, 2, 3, 0]);
  assert.equal(rowScore(c, attempts, 0), 0);
  assert.equal(isComplete(c, attempts), true);
  assert.equal(revealRemaining(c, attempts, 0), null);
  assert.equal(attempts[0].length, 4);
  assert.equal(rowScore({ ...c, points: [6, 2, 1, 0.5] }, attempts, 0), 0.5);
});
test("automatic-reveal metadata survives restoration only for valid final completions", () => {
  const attempts = [[1, 2, 3, 0], [3], [0, 2, 3, 1]];
  assert.deepEqual(
    [...restoreAutomaticReveals(c, attempts, [0, 1, 2, 2, -1, 8, "0"])],
    [0, 2],
  );
  assert.deepEqual([...restoreAutomaticReveals(c, attempts, null)], []);
});
test("next unfinished cycles through both not-started and started questions", () => {
  const attempts = [[0], [1], []];
  assert.equal(nextUnfinished(c, attempts), 1);
  assert.equal(nextUnfinished(c, attempts, 1), 2);
  assert.equal(nextUnfinished(c, attempts, 2), 1);
  assert.equal(nextUnfinished(c, [[0], [3], [1]], 2), -1);
});
test("two-choice questions reveal the remaining answer after the first wrong attempt", () => {
  const c2 = { choiceCount: 2, points: [2, 1], answers: [1] },
    a = [[0]];
  assert.equal(revealRemaining(c2, a, 0), 1);
  assert.equal(rowScore(c2, a, 0), 1);
});
