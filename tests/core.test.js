import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalize,
  encode,
  decode,
  activityId,
  sanitizeAttempts,
  rowScore,
  totalScore,
  maximum,
} from "../core.js";
const c = {
  version: 1,
  title: "Climate 🌍",
  description: "Unicode → feedback",
  startNumber: 21,
  choiceCount: 4,
  points: [6, 2, 1, 0],
  answers: [1, 3, 0, 2],
};
test("encrypted links round-trip Unicode and randomize without changing identity", async () => {
  const a = await encode(c),
    b = await encode(c);
  assert.notEqual(a, b);
  assert.deepEqual(await decode(a), c);
  assert.equal(
    await activityId(await decode(a)),
    await activityId(await decode(b)),
  );
  assert.notEqual(
    await activityId(c),
    await activityId({ ...c, points: [5, 2, 1, 0] }),
  );
});
test("corrupted ciphertext is rejected", async () => {
  const a = await encode(c),
    i = 100;
  await assert.rejects(() =>
    decode(a.slice(0, i) + (a[i] === "A" ? "B" : "A") + a.slice(i + 1)),
  );
});
test("partial credit, unfinished and completed questions", () => {
  const a = [[0, 1], [0, 1, 3], [], [0, 1, 3, 2]];
  assert.equal(rowScore(c, a, 0), 2);
  assert.equal(rowScore(c, a, 1), 1);
  assert.equal(rowScore(c, a, 2), 0);
  assert.equal(rowScore(c, a, 3), 0);
  assert.equal(totalScore(c, a), 3);
  assert.equal(maximum(c), 24);
});
test("restored progress rejects duplicates, invalid choices, and post-correct attempts", () => {
  assert.deepEqual(
    sanitizeAttempts(c, [
      [0, 0, 9, 1, 3],
      [-1, 2, 3, 0],
      null,
      [false, "2", 1],
    ]),
    [[0, 1], [2, 3], [], [1]],
  );
});
test("invalid keys and increasing scoring rules are rejected", () => {
  assert.throws(() => normalize({ ...c, answers: [4] }));
  assert.throws(() => normalize({ ...c, points: [6, 7, 1, 0] }));
  assert.throws(() => normalize({ ...c, answers: [null] }));
  assert.throws(() => normalize({ ...c, points: [0, 0, 0, 0] }));
  assert.throws(() => normalize({ ...c, startNumber: 0 }));
});

test("student links cannot be opened as edit links by changing the route", async () => {
  const student = await encode(c),
    edit = await encode(c, "edit");
  await assert.rejects(() => decode(student, "edit"));
  await assert.rejects(() => decode(edit));
  assert.deepEqual(await decode(edit, "edit"), c);
});
