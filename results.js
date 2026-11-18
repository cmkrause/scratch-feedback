import {
  normalize,
  sanitizeAttempts,
  restoreAutomaticReveals,
  isComplete,
  activityId,
  encode,
  decode,
  letters,
  rowScore,
  totalScore,
  maximum,
} from "./core.js?v=1.5.0";

export const RESULTS_FORMAT = "scratch-feedback-results";
export const RESULTS_SCHEMA_VERSION = 1;
export const RESULTS_ATTACHMENT_NAME = "scratch-feedback-results.json";

// Snapshot before awaiting anything so the PDF and attachment describe the same state.
export async function buildResults(
  session,
  { baseUrl, generatedAt = new Date() } = {},
) {
  const c = normalize(session.c);
  const attempts = sanitizeAttempts(c, session.attempts);
  const automatic = restoreAutomaticReveals(
    c,
    attempts,
    Array.from(session.autoRevealed ?? []),
  );
  const mode = session.example
    ? "example"
    : session.preview
      ? "preview"
      : "activity";
  let token = session.token;
  if (!isComplete(c, attempts))
    throw Error("Complete every question before downloading results.");
  const date = new Date(generatedAt);
  if (!Number.isFinite(date.getTime())) throw Error("Invalid export date.");
  const url = new URL(baseUrl);
  if (!["https:", "http:"].includes(url.protocol))
    throw Error("An HTTP or HTTPS activity address is required.");
  url.hash = "";
  const configurationHash = await activityId(c);
  if (token) {
    if ((await activityId(await decode(token))) !== configurationHash)
      throw Error("Activity link does not match the results configuration.");
  } else {
    // Unsaved examples/previews also get a self-contained, reopenable activity link.
    token = await encode(c);
  }
  url.hash = "/activity/" + token;
  return {
    format: RESULTS_FORMAT,
    schemaVersion: RESULTS_SCHEMA_VERSION,
    generatedAt: date.toISOString(),
    mode,
    activity: {
      url: url.href,
      configurationHash,
      title: c.title,
      description: c.description,
      startNumber: c.startNumber,
      questionCount: c.answers.length,
      choiceCount: c.choiceCount,
      pointsByAttempt: [...c.points],
    },
    summary: {
      complete: true,
      completedQuestionCount: c.answers.length,
      pointsEarned: totalScore(c, attempts),
      pointsPossible: maximum(c),
    },
    questions: c.answers.map((answer, i) => ({
      number: c.startNumber + i,
      attempts: attempts[i].map((a, j) => ({
        attempt: j + 1,
        choice: letters[a],
        correct: a === answer,
        source:
          automatic.has(i) && j === attempts[i].length - 1
            ? "automatic"
            : "student",
      })),
      automaticReveal: automatic.has(i),
      pointsEarned: rowScore(c, attempts, i),
      pointsPossible: c.points[0],
    })),
  };
}
