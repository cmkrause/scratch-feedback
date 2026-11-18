export const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function validate(c) {
  if (
    !c ||
    c.version !== 1 ||
    typeof c.title !== "string" ||
    !c.title.trim() ||
    c.title.length > 160 ||
    typeof c.description !== "string" ||
    c.description.length > 2000
  )
    throw Error("Check the activity title and description.");
  if (
    !Number.isInteger(c.startNumber) ||
    c.startNumber < 1 ||
    c.startNumber > 99999
  )
    throw Error("Starting number must be between 1 and 99,999.");
  if (
    !Number.isInteger(c.choiceCount) ||
    c.choiceCount < 2 ||
    c.choiceCount > 10
  )
    throw Error("Choose between 2 and 10 answer choices.");
  if (
    !Array.isArray(c.answers) ||
    c.answers.length < 1 ||
    c.answers.length > 200 ||
    c.answers.some((a) => !Number.isInteger(a) || a < 0 || a >= c.choiceCount)
  )
    throw Error("Select a valid correct answer for every question.");
  if (
    !Array.isArray(c.points) ||
    c.points.length !== c.choiceCount ||
    c.points.some(
      (p, i) =>
        !Number.isFinite(p) ||
        p < 0 ||
        p > 10000 ||
        (i > 0 && p > c.points[i - 1]),
    ) ||
    c.points[0] <= 0
  )
    throw Error(
      "Enter a positive first-attempt score and nonnegative scores that stay equal or decrease.",
    );
  return c;
}
export function normalize(c) {
  validate(c);
  return {
    version: 1,
    title: c.title.trim(),
    description: c.description.trim(),
    startNumber: c.startNumber,
    choiceCount: c.choiceCount,
    points: [...c.points],
    answers: [...c.answers],
  };
}
export function to64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
export function from64(s) {
  if (!/^[\w-]+$/.test(s)) throw Error("Invalid link encoding.");
  return Uint8Array.from(
    atob(s.replaceAll("-", "+").replaceAll("_", "/")),
    (x) => x.charCodeAt(0),
  );
}
async function streamBytes(bytes, stream) {
  return new Uint8Array(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(stream),
    ).arrayBuffer(),
  );
}
export async function encode(c, purpose = "activity") {
  if (!["activity", "edit"].includes(purpose))
    throw Error("Invalid link purpose.");
  let bytes = new TextEncoder().encode(
      JSON.stringify({ purpose, configuration: normalize(c) }),
    ),
    flag = 0;
  if (typeof CompressionStream !== "undefined") {
    const compressed = await streamBytes(
      bytes,
      new CompressionStream("deflate"),
    );
    if (compressed.length < bytes.length) {
      bytes = compressed;
      flag = 1;
    }
  }
  const raw = crypto.getRandomValues(new Uint8Array(32)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
  ]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes),
  );
  const packed = new Uint8Array(46 + encrypted.length);
  packed.set([1, flag]);
  packed.set(raw, 2);
  packed.set(iv, 34);
  packed.set(encrypted, 46);
  return to64(packed);
}
export async function decode(token, expectedPurpose = "activity") {
  if (token.length > 40000) throw Error("This activity link is too large.");
  const p = from64(token);
  if (p.length < 62 || p[0] !== 1 || p[1] > 1)
    throw Error("Unsupported or incomplete activity link.");
  const key = await crypto.subtle.importKey(
    "raw",
    p.slice(2, 34),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  let bytes = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: p.slice(34, 46) },
      key,
      p.slice(46),
    ),
  );
  if (p[1]) {
    if (typeof DecompressionStream === "undefined")
      throw Error("Please open this link in an up-to-date browser.");
    bytes = await streamBytes(bytes, new DecompressionStream("deflate"));
  }
  if (bytes.length > 50000) throw Error("This configuration is too large.");
  const data = JSON.parse(new TextDecoder().decode(bytes));
  const purpose = data.purpose ?? "activity";
  if (purpose !== expectedPurpose)
    throw Error("This link is not an " + expectedPurpose + " link.");
  return normalize(data.configuration ?? data);
}
export async function activityId(c) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(normalize(c))),
      ),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function sanitizeAttempts(c, data) {
  return c.answers.map((answer, i) => {
    const out = [];
    for (const a of Array.isArray(data?.[i]) ? data[i] : []) {
      if (
        Number.isInteger(a) &&
        a >= 0 &&
        a < c.choiceCount &&
        !out.includes(a)
      ) {
        out.push(a);
        if (a === answer) break;
      }
    }
    return out;
  });
}
export function rowScore(c, attempts, i) {
  const a = attempts[i];
  return a.includes(c.answers[i]) ? c.points[a.indexOf(c.answers[i])] : 0;
}
export function totalScore(c, attempts) {
  return c.answers.reduce((sum, _, i) => sum + rowScore(c, attempts, i), 0);
}
export function maximum(c) {
  return c.answers.length * c.points[0];
}
export function fmt(n) {
  return Number(n.toFixed(4)).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });
}

export function isComplete(c, attempts) {
  return c.answers.every((answer, i) => attempts[i]?.includes(answer));
}

export function remainingAnswer(c, attempts, i) {
  const tried = attempts[i] ?? [];
  return !tried.includes(c.answers[i]) && tried.length === c.choiceCount - 1
    ? c.answers[i]
    : null;
}
export function revealRemaining(c, attempts, i) {
  const answer = remainingAnswer(c, attempts, i);
  if (answer !== null) attempts[i].push(answer);
  return answer;
}
export function restoreAutomaticReveals(c, attempts, values) {
  return new Set(
    (Array.isArray(values) ? values : []).filter(
      (i) =>
        Number.isInteger(i) &&
        i >= 0 &&
        i < c.answers.length &&
        attempts[i]?.length === c.choiceCount &&
        attempts[i].at(-1) === c.answers[i],
    ),
  );
}
export function nextUnfinished(c, attempts, current = -1) {
  for (let step = 1; step <= c.answers.length; step++) {
    const i = (current + step + c.answers.length) % c.answers.length;
    if (!attempts[i]?.includes(c.answers[i])) return i;
  }
  return -1;
}
