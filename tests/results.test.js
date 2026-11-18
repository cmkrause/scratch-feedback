import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { buildResults, RESULTS_ATTACHMENT_NAME } from "../results.js";
import { createResultsPdf } from "../export.js";
import { encode, decode, activityId } from "../core.js";
const schema = JSON.parse(
  await fs.readFile(
    new URL("../schemas/results-v1.schema.json", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const config = () => ({
  version: 1,
  title: "Results check",
  description: "Check ordered attempts and automatic reveals.",
  startNumber: 21,
  choiceCount: 4,
  points: [6, 2, 1, 0],
  answers: [1, 3, 0],
});
async function fixture() {
  const c = config();
  return {
    c,
    token: await encode(c),
    preview: false,
    id: "not-used",
    attempts: [[0, 1], [3], [1, 2, 3, 0]],
    autoRevealed: new Set([2]),
  };
}
const options = {
  baseUrl: "https://cmkrause.github.io/scratch-feedback/#/results/old",
  generatedAt: "2026-11-18T20:00:00.000Z",
};
test("complete results match schema, preserve full payload/hash, and describe ordered attempts", async () => {
  const session = await fixture(),
    r = await buildResults(session, options);
  assert.equal(validate(r), true, JSON.stringify(validate.errors));
  assert.equal(
    r.activity.url,
    "https://cmkrause.github.io/scratch-feedback/#/activity/" + session.token,
  );
  assert.equal(r.activity.configurationHash, await activityId(session.c));
  assert.equal(r.activity.configurationHash.length, 64);
  assert.deepEqual(r.summary, {
    complete: true,
    completedQuestionCount: 3,
    pointsEarned: 8,
    pointsPossible: 18,
  });
  assert.deepEqual(r.questions[0].attempts, [
    { attempt: 1, choice: "A", correct: false, source: "student" },
    { attempt: 2, choice: "B", correct: true, source: "student" },
  ]);
  assert.equal(r.questions[2].attempts.at(-1).source, "automatic");
  assert.equal(r.questions[2].automaticReveal, true);
  assert.equal(r.questions[2].pointsEarned, 0);
  assert.equal("id" in r.activity, false);
});
test("example and preview exports contain a reopenable full link with the same configuration hash", async () => {
  for (const example of [true, false]) {
    const session = await fixture();
    session.token = null;
    session.preview = true;
    session.example = example;
    const r = await buildResults(session, options);
    assert.equal(r.mode, example ? "example" : "preview");
    assert.equal(validate(r), true);
    assert.deepEqual(
      await decode(new URL(r.activity.url).hash.split("/activity/")[1]),
      session.c,
    );
  }
});
test("results are snapshotted before async work; tentative state is not exported", async () => {
  const session = await fixture(),
    originalHash = await activityId(session.c);
  session.pending = { 0: 2 };
  const promise = buildResults(session, options);
  session.c.title = "Changed later";
  session.attempts[0][0] = 2;
  session.autoRevealed.clear();
  const r = await promise;
  assert.equal(r.activity.title, "Results check");
  assert.equal(r.questions[0].attempts[0].choice, "A");
  assert.equal(r.questions[2].automaticReveal, true);
  assert.equal(r.activity.configurationHash, originalHash);
  assert.equal("pending" in r, false);
});
test("incomplete exports, mismatched links, invalid dates, and unsafe base URLs are rejected", async () => {
  const s = await fixture();
  s.attempts[1] = [];
  await assert.rejects(buildResults(s, options), /Complete every question/);
  const other = await fixture();
  other.token = await encode({ ...other.c, title: "Other" });
  await assert.rejects(buildResults(other, options), /does not match/);
  await assert.rejects(
    buildResults(await fixture(), { ...options, generatedAt: "invalid" }),
    /Invalid export date/,
  );
  await assert.rejects(
    buildResults(await fixture(), {
      ...options,
      baseUrl: "javascript:alert(1)",
    }),
    /HTTP or HTTPS/,
  );
});
test("schema rejects unknown versions, short hashes, names, invalid choice labels and automatic incorrect answers", async () => {
  const original = await buildResults(await fixture(), options);
  for (const change of [
    (r) => (r.schemaVersion = 2),
    (r) => (r.activity.configurationHash = "abc123"),
    (r) => (r.studentName = "Name"),
    (r) => (r.questions[0].attempts[0].choice = "Z"),
    (r) => (r.questions[0].attempts[0].source = "automatic"),
  ]) {
    const r = structuredClone(original);
    change(r);
    assert.equal(validate(r), false);
  }
});
test("documented example validates and its payload matches its hash", async () => {
  const r = JSON.parse(
    await fs.readFile(
      new URL("../docs/results-v1.example.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(validate(r), true, JSON.stringify(validate.errors));
  const c = await decode(new URL(r.activity.url).hash.split("/activity/")[1]);
  assert.equal(await activityId(c), r.activity.configurationHash);
});
test("generated PDF contains exactly the results snapshot as a UTF-8 JSON attachment", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "scratch-pdf-test-"));
  try {
    // Vendors are UMD browser bundles; load copies as CommonJS for this integration check.
    for (const name of ["jspdf.umd.min", "pdf-lib.min"])
      writeFileSync(
        path.join(dir, name + ".cjs"),
        readFileSync(
          new URL("../assets/vendor/" + name + ".js", import.meta.url),
        ),
      );
    const require = createRequire(import.meta.url),
      { jsPDF } = require(path.join(dir, "jspdf.umd.min.cjs")),
      lib = require(path.join(dir, "pdf-lib.min.cjs"));
    const font = new Uint8Array(
      await fs.readFile(
        new URL("../assets/fonts/atkinson-next-regular.ttf", import.meta.url),
      ),
    );
    for (const count of [3, 35]) {
      const session = await fixture();
      if (count > 3) {
        session.c.answers = Array(count).fill(0);
        session.attempts = Array.from({ length: count }, () => [0]);
        session.autoRevealed = new Set();
        session.token = await encode(session.c);
      }
      const r = await buildResults(session, options),
        bytes = await createResultsPdf(r, {
          jsPDF,
          PDFDocument: lib.PDFDocument,
          font,
        });
      const pdf = await lib.PDFDocument.load(bytes),
        root = pdf.catalog.lookup(lib.PDFName.of("Names"), lib.PDFDict),
        files = root
          .lookup(lib.PDFName.of("EmbeddedFiles"), lib.PDFDict)
          .lookup(lib.PDFName.of("Names"), lib.PDFArray);
      assert.equal(files.size(), 2);
      assert.equal(
        files.lookup(0, lib.PDFHexString).decodeText(),
        RESULTS_ATTACHMENT_NAME,
      );
      const spec = files.lookup(1, lib.PDFDict),
        stream = spec
          .lookup(lib.PDFName.of("EF"), lib.PDFDict)
          .lookup(lib.PDFName.of("F"), lib.PDFRawStream);
      const data = lib.decodePDFRawStream(stream).decode();
      assert.deepEqual(JSON.parse(new TextDecoder().decode(data)), r);
      assert.equal(validate(JSON.parse(new TextDecoder().decode(data))), true);
      if (count > 3) assert.ok(pdf.getPageCount() > 1);
      if (process.env.SF_PDF_CHECK_DIR) {
        await fs.mkdir(process.env.SF_PDF_CHECK_DIR, { recursive: true });
        await fs.writeFile(
          path.join(process.env.SF_PDF_CHECK_DIR, `results-${count}.pdf`),
          bytes,
        );
      }
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
