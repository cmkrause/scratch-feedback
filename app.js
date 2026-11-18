import {
  letters,
  normalize,
  validate,
  encode,
  decode,
  activityId,
  sanitizeAttempts,
  rowScore,
  totalScore,
  maximum,
  isComplete,
  remainingAnswer,
  revealRemaining,
  restoreAutomaticReveals,
  nextUnfinished,
  fmt,
} from "./core.js?v=1.3.0";
import { confirmationLeft } from "./ui.js?v=1.3.0";
import { exportPDF } from "./export.js?v=1.3.0";
const $ = (s) => document.querySelector(s),
  app = $("#app");
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let storageWarned = false;
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    if (!storageWarned) {
      storageWarned = true;
      toast(
        "Browser storage is unavailable. Keep this page open; progress may not be restored.",
      );
    }
  }
}
function toast(text) {
  $("#notice").textContent = text;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#notice").textContent = ""), 6000);
}
let prefs = {
  theme: "system",
  confirm: true,
  single: false,
  hideScores: false,
  ...read("sf.preferences", {}),
};
function theme() {
  document.documentElement.dataset.theme =
    prefs.theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : prefs.theme;
}
theme();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", theme);
$("#settings-open").onclick = () => {
  $("#theme").value = prefs.theme;
  $("#confirm-setting").checked = prefs.confirm;
  $("#single-setting").checked = prefs.single;
  $("#score-setting").checked = prefs.hideScores;
  $("#settings").showModal();
};
$("#theme").onchange = (e) => {
  prefs.theme = e.target.value;
  save("sf.preferences", prefs);
  theme();
};
$("#confirm-setting").onchange = (e) => {
  prefs.confirm = e.target.checked;
  save("sf.preferences", prefs);
  pending = {};
  if (session && view === "activity") renderActivity();
};
$("#single-setting").onchange = (e) => {
  prefs.single = e.target.checked;
  save("sf.preferences", prefs);
  if (session && view === "activity") renderActivity();
};
$("#score-setting").onchange = (e) => {
  prefs.hideScores = e.target.checked;
  save("sf.preferences", prefs);
  clearTimeout(toast.timer);
  $("#notice").textContent = "";
  if (session && view === "activity") renderActivity();
};
function feedbackSymbol(correct) {
  return `<span class="feedback-symbol" aria-hidden="true">${correct ? "✓" : "×"}</span>`;
}
for (const d of document.querySelectorAll("dialog"))
  d.addEventListener("click", (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        d.close();
    }
  });
let draft = read("sf.draft", null) || {
  version: 1,
  title: "",
  description: "",
  startNumber: 1,
  choiceCount: 4,
  points: [6, 2, 1, 0],
  answers: Array(10).fill(null),
};
try {
  if (
    !Array.isArray(draft.answers) ||
    !Array.isArray(draft.points) ||
    draft.choiceCount < 2 ||
    draft.choiceCount > 10
  )
    throw Error();
} catch {
  draft = {
    version: 1,
    title: "",
    description: "",
    startNumber: 1,
    choiceCount: 4,
    points: [6, 2, 1, 0],
    answers: Array(10).fill(null),
  };
}
let session = null,
  view = "creator",
  questionIndex = 0,
  pending = {},
  feedback = {},
  routeGeneration = 0,
  navigationCursor = -1;
const revealTimers = new Map(),
  collapseTimers = new Map(),
  holdOpen = new Set(),
  expandedCompleted = new Set();
function setView(title) {
  document.title = title + " · Scratch Feedback";
}
function landing() {
  clearSessionTimers();
  session = null;
  view = "home";
  setView("Instant feedback");
  app.innerHTML = `<div class="landing"><p class="eyebrow">Simple answer sheets. Immediate feedback.</p><h1>Scratch Feedback</h1><p class="landing-intro">Try an answer. Learn from the feedback. Keep going.</p><p>Create a multiple-choice answer sheet with partial credit, then share it with one link. Students work through the questions and download their completed results.</p><div class="toolbar"><a class="button-link" href="#/create">Create an activity</a><a class="button-link secondary" href="#/example">Try an example</a></div><section class="landing-how"><h2>How it works</h2><ol><li><strong>Set up.</strong> Choose your answer key, numbering, and points for each attempt.</li><li><strong>Share.</strong> Give students the activity link or QR code alongside your questions.</li><li><strong>Learn.</strong> Students receive instant feedback and a PDF of their results when finished.</li></ol></section><p class="muted landing-note">No accounts required. Progress stays in the current browser.</p><a class="source-link" href="https://github.com/cmkrause/scratch-feedback">View the project on GitHub</a></div>`;
}
function example() {
  startSession(
    {
      version: 1,
      title: "Try Scratch Feedback",
      description:
        "Choose an answer for each question. Explore the feedback and settings as you go.",
      startNumber: 1,
      choiceCount: 4,
      points: [6, 2, 1, 0],
      answers: [1, 3, 0],
    },
    null,
    true,
  );
  session.example = true;
  renderActivity();
}
function creator() {
  clearSessionTimers();
  view = "creator";
  session = null;
  setView("Create activity");
  app.innerHTML = `<h1>Create an activity</h1><p class="muted">Set the key. Share the link. Give instant feedback.</p><form id="creator"><label>Activity title<input id="title" maxlength="160" required placeholder="Unit 3 Group Exam" value="${esc(draft.title)}"></label><label>Description <span class="muted">(optional)</span><textarea id="description" maxlength="2000" rows="2" placeholder="Instructions for students">${esc(draft.description)}</textarea></label><div class="fields"><label>Questions<input id="count" type="number" min="1" max="200" step="1" required value="${draft.answers.length}"></label><label>Starting number<input id="start" type="number" min="1" max="99999" step="1" required value="${draft.startNumber}"></label><label>Answer choices<select id="choices">${Array.from({ length: 9 }, (_, i) => `<option ${draft.choiceCount === i + 2 ? "selected" : ""}>${i + 2}</option>`).join("")}</select></label></div><fieldset><legend>Points by successful attempt</legend><div id="points" class="points"></div></fieldset><div class="section-heading"><h2>Answer key</h2><span id="key-count" class="muted"></span></div><p class="muted">Choose the correct answer for each question. Question text is provided separately.</p><div id="key-grid"></div><p id="form-error" class="error" role="alert"></p><div class="toolbar"><button type="submit">Create link</button><button type="button" class="secondary" id="preview">Preview</button></div></form>`;
  renderPoints();
  renderKey();
  $("#title").oninput = (e) => {
    draft.title = e.target.value;
    storeDraft();
  };
  $("#description").oninput = (e) => {
    draft.description = e.target.value;
    storeDraft();
  };
  $("#count").oninput = (e) => {
    const n = Number(e.target.value);
    if (!Number.isInteger(n) || n < 1 || n > 200) return;
    draft.answers = Array.from(
      { length: n },
      (_, i) => draft.answers[i] ?? null,
    );
    storeDraft();
    renderKey();
  };
  $("#start").oninput = (e) => {
    draft.startNumber = Number(e.target.value);
    storeDraft();
    renderKey();
  };
  $("#choices").onchange = (e) => {
    draft.choiceCount = Number(e.target.value);
    draft.points = Array.from(
      { length: draft.choiceCount },
      (_, i) => draft.points[i] ?? 0,
    );
    let invalid = false;
    draft.answers = draft.answers.map((a) => {
      if (a !== null && a >= draft.choiceCount) {
        invalid = true;
        return null;
      }
      return a;
    });
    storeDraft();
    renderPoints();
    renderKey();
    if (invalid)
      toast(
        "Some correct answers are no longer available. Select replacements before sharing.",
      );
  };
  $("#creator").onsubmit = async (e) => {
    e.preventDefault();
    await makeLink();
  };
  $("#preview").onclick = () => {
    try {
      validate(draft);
      startSession(normalize(draft), null, true);
      renderActivity();
    } catch (e) {
      $("#form-error").textContent = e.message;
    }
  };
}
function storeDraft() {
  save("sf.draft", draft);
}
function renderPoints() {
  $("#points").innerHTML = draft.points
    .map(
      (p, i) =>
        `<label>Attempt ${i + 1}<input aria-label="Points for attempt ${i + 1}" type="number" min="0" max="10000" step="0.01" required data-point="${i}" value="${p}"></label>`,
    )
    .join("");
  for (const el of document.querySelectorAll("[data-point]"))
    el.oninput = () => {
      draft.points[Number(el.dataset.point)] =
        el.value === "" ? NaN : Number(el.value);
      storeDraft();
    };
}
function renderKey() {
  const selected = draft.answers.filter((a) => a !== null).length;
  $("#key-count").textContent = `${selected} / ${draft.answers.length} set`;
  $("#key-grid").innerHTML = draft.answers
    .map(
      (a, i) =>
        `<section class="answer-row" aria-label="Question ${draft.startNumber + i}"><h3>Question ${draft.startNumber + i}</h3><div class="choices" role="group" aria-label="Correct answer for question ${draft.startNumber + i}">${Array.from({ length: draft.choiceCount }, (_, j) => `<button type="button" class="choice ${a === j ? "selected" : ""}" aria-pressed="${a === j}" data-row="${i}" data-choice="${j}">${letters[j]}</button>`).join("")}</div></section>`,
    )
    .join("");
  for (const b of document.querySelectorAll("[data-row]"))
    b.onclick = () => {
      draft.answers[+b.dataset.row] = +b.dataset.choice;
      storeDraft();
      const row = +b.dataset.row,
        choice = +b.dataset.choice;
      renderKey();
      document
        .querySelector(`[data-row="${row}"][data-choice="${choice}"]`)
        .focus();
    };
}
async function makeLink() {
  const btn = $("#creator button[type=submit]");
  try {
    validate(draft);
    btn.disabled = true;
    const token = await encode(draft),
      editToken = await encode(draft, "edit"),
      base = location.href.split("#")[0];
    $("#student-link").value = `${base}#/activity/${token}`;
    $("#edit-link").value = `${base}#/edit/${editToken}`;
    $("#qr").replaceChildren();
    $("#qr-note").textContent = "";
    try {
      const qr = window.qrcode(0, "L");
      qr.addData($("#student-link").value);
      qr.make();
      $("#qr").innerHTML = qr.createSvgTag({
        cellSize: 3,
        margin: 0,
        scalable: true,
      });
    } catch {
      $("#qr-note").textContent =
        "This activity is too large for a QR code. Share the link instead.";
    }
    $("#share").showModal();
  } catch (e) {
    $("#form-error").textContent = e.message;
  } finally {
    btn.disabled = false;
  }
}
async function copy(selector) {
  try {
    await navigator.clipboard.writeText($(selector).value);
    toast("Link copied.");
  } catch {
    $(selector).focus();
    $(selector).select();
    toast("Select and copy the link above.");
  }
}
$("#copy-student").onclick = () => copy("#student-link");
$("#copy-edit").onclick = () => copy("#edit-link");
function startSession(c, token, preview = false, id = "preview") {
  clearSessionTimers();
  const stored = preview ? {} : read("sf.activity." + id, {});
  session = {
    c,
    token,
    preview,
    id,
    attempts: sanitizeAttempts(c, stored.attempts),
  };
  session.autoRevealed = restoreAutomaticReveals(
    c,
    session.attempts,
    stored.autoRevealed,
  );
  questionIndex = 0;
  navigationCursor = -1;
  pending = {};
  feedback = {};
  for (const i of session.autoRevealed) feedback[i] = "auto";
}
function persist() {
  if (!session.preview)
    save("sf.activity." + session.id, {
      attempts: session.attempts,
      autoRevealed: Array.from(session.autoRevealed),
    });
}
function heading() {
  return `${session.example ? '<p class="eyebrow">Example activity · <a href="#/">Back to home</a></p>' : session.preview ? '<p class="preview-note">Preview · attempts here are not saved. <button class="quiet" id="back-editor">Back to editor</button></p>' : ""}<h1>${esc(session.c.title)}</h1>${session.c.description ? `<p class="description">${esc(session.c.description)}</p>` : ""}${session.example ? "" : `<div class="eyebrow">Activity ${session.id.slice(0, 10)}</div>`}`;
}
function wirePreview() {
  if ($("#back-editor")) $("#back-editor").onclick = creator;
}
function renderActivity() {
  view = "activity";
  const { c, attempts } = session;
  // Also finish eligible questions restored from a previous visit or an older app version.
  c.answers.forEach((_, i) => {
    if (remainingAnswer(c, attempts, i) !== null) scheduleReveal(i);
  });
  setView(c.title);
  const completed = attempts.filter((a, i) => a.includes(c.answers[i])).length;
  app.innerHTML =
    heading() +
    `<div class="summary">${!prefs.hideScores ? `<span>Score <strong class="score">${fmt(totalScore(c, attempts))} / ${fmt(maximum(c))}</strong></span>` : ""}<span class="muted">${completed} / ${c.answers.length} complete</span></div><div id="questions"></div>${prefs.single ? `<nav class="pagination" aria-label="Question navigation"><button class="secondary" id="previous" ${questionIndex === 0 ? "disabled" : ""}>Previous</button><span>Question ${c.startNumber + questionIndex}<br>${questionIndex + 1} of ${c.answers.length}</span><button class="secondary" id="next" ${questionIndex === c.answers.length - 1 ? "disabled" : ""}>Next</button></nav>` : ""}<div class="toolbar">${completed !== c.answers.length ? '<button class="secondary" id="unfinished">Go to next unfinished question</button>' : ""}<button id="results" ${completed !== c.answers.length ? "disabled" : ""}>View results</button></div>${completed !== c.answers.length ? '<p class="muted results-hint">Complete every question to view results.</p>' : ""}`;
  wirePreview();
  const indices = prefs.single ? [questionIndex] : c.answers.map((_, i) => i);
  $("#questions").innerHTML = indices
    .map((i) => {
      const tried = attempts[i],
        done = tried.includes(c.answers[i]);
      const collapsed =
        done && !prefs.single && !holdOpen.has(i) && !expandedCompleted.has(i);
      const revealing = remainingAnswer(c, attempts, i) !== null;
      const label = `Question ${c.startNumber + i}`;
      return `<section class="answer-row ${collapsed ? "collapsed" : ""}" id="question-${i}" aria-labelledby="qtitle-${i}"><div class="question-heading"><h2 id="qtitle-${i}">${done && !prefs.single ? `<button class="question-toggle" data-toggle="${i}" aria-expanded="${!collapsed}" aria-controls="qbody-${i}"><span>${label}</span><span class="completion-label">${feedbackSymbol(true)} Complete</span></button>` : label}</h2>${!prefs.hideScores ? `<span class="question-score">${fmt(rowScore(c, attempts, i))} / ${fmt(c.points[0])} points</span>` : ""}</div><div id="qbody-${i}" ${collapsed ? "hidden" : ""}><div class="choices" role="group" aria-label="Answers for question ${c.startNumber + i}">${Array.from(
        { length: c.choiceCount },
        (_, j) => {
          const scratched = tried.includes(j),
            correct = scratched && j === c.answers[i];
          return `<button class="choice ${scratched ? (correct ? "correct" : "wrong") : pending[i] === j ? "selected" : ""} ${correct && session.autoRevealed.has(i) && holdOpen.has(i) ? "auto-reveal" : ""}" data-question="${i}" data-choice="${j}" ${done || scratched || revealing ? "disabled" : ""} ${!scratched ? `aria-pressed="${pending[i] === j}"` : ""} aria-label="${letters[j]}${scratched ? (correct ? ", Correct" : ", Incorrect") : ""}">${letters[j]}${scratched ? " " + feedbackSymbol(correct) : ""}</button>`;
        },
      ).join(
        "",
      )}</div>${!done && !revealing ? `<div class="confirm-row" id="confirm-${i}" ${pending[i] === undefined ? "hidden" : ""}><button data-confirm="${i}">Confirm ${letters[pending[i]] ?? ""}</button></div>` : ""}<p class="question-feedback ${feedback[i] === undefined ? "" : feedback[i] ? "correct-text" : "wrong-text"}" id="feedback-${i}" role="status" aria-live="polite">${feedback[i] === undefined ? "" : esc(answerFeedback(i))}</p></div></section>`;
    })
    .join("");
  positionConfirmations();
  for (const b of document.querySelectorAll("[data-question]"))
    b.onclick = () => selectChoice(+b.dataset.question, +b.dataset.choice);
  for (const b of document.querySelectorAll("[data-confirm]"))
    b.onclick = () =>
      commitChoice(+b.dataset.confirm, pending[+b.dataset.confirm]);
  for (const b of document.querySelectorAll("[data-toggle]"))
    b.onclick = () => {
      const i = +b.dataset.toggle,
        wasExpanded = b.getAttribute("aria-expanded") === "true";
      clearTimeout(collapseTimers.get(i));
      collapseTimers.delete(i);
      holdOpen.delete(i);
      if (wasExpanded) expandedCompleted.delete(i);
      else expandedCompleted.add(i);
      renderActivityStable();
      document
        .querySelector(`[data-toggle="${i}"]`)
        ?.focus({ preventScroll: true });
    };
  $("#results").onclick = () => {
    if (!isComplete(c, attempts)) return;
    if (session.preview) renderResults();
    else location.hash = `/results/${session.token}`;
  };
  if ($("#unfinished"))
    $("#unfinished").onclick = () => {
      const i = nextUnfinished(c, attempts, navigationCursor);
      if (i < 0) return;
      navigationCursor = i;
      questionIndex = i;
      if (prefs.single) renderActivity();
      const target = $("#qtitle-" + i);
      target.setAttribute("tabindex", "-1");
      target.scrollIntoView({
        block: "center",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      target.focus({ preventScroll: true });
    };
  if (prefs.single) {
    $("#previous").onclick = () => {
      questionIndex--;
      navigationCursor = questionIndex;
      renderActivity();
      focusQuestion(questionIndex);
    };
    $("#next").onclick = () => {
      questionIndex++;
      navigationCursor = questionIndex;
      renderActivity();
      focusQuestion(questionIndex);
    };
  }
}
function focusQuestion(i) {
  const target = $("#qtitle-" + i);
  if (target) {
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
}
function renderActivityStable() {
  const rows = Array.from(document.querySelectorAll(".answer-row"));
  const anchor =
    rows.find((el) => el.getBoundingClientRect().top >= 0) ??
    rows.find((el) => el.getBoundingClientRect().bottom > 0);
  const top = anchor?.getBoundingClientRect().top,
    id = anchor?.id;
  const active = document.activeElement;
  const question = active?.dataset.question,
    choice = active?.dataset.choice,
    confirm = active?.dataset.confirm,
    toggle = active?.dataset.toggle,
    focusId = active?.id;
  renderActivity();
  if (id && $("#" + id))
    window.scrollBy(0, $("#" + id).getBoundingClientRect().top - top);
  const selector =
    question !== undefined
      ? `[data-question="${question}"][data-choice="${choice}"]`
      : confirm !== undefined
        ? `[data-confirm="${confirm}"]`
        : toggle !== undefined
          ? `[data-toggle="${toggle}"]`
          : focusId
            ? "#" + CSS.escape(focusId)
            : null;
  const target = selector ? document.querySelector(selector) : null;
  if (target && !target.disabled && target.getClientRects().length) {
    if (!target.matches("button, a[href], input, select, textarea, [tabindex]"))
      target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
}
function clearSessionTimers() {
  for (const timer of revealTimers.values()) clearTimeout(timer);
  for (const timer of collapseTimers.values()) clearTimeout(timer);
  revealTimers.clear();
  collapseTimers.clear();
  holdOpen.clear();
  expandedCompleted.clear();
}
function keepCompletedOpen(i) {
  const owner = session;
  holdOpen.add(i);
  expandedCompleted.delete(i);
  clearTimeout(collapseTimers.get(i));
  collapseTimers.set(
    i,
    setTimeout(() => {
      collapseTimers.delete(i);
      if (session !== owner) return;
      holdOpen.delete(i);
      if (view === "activity" && !prefs.single) renderActivityStable();
    }, 2000),
  );
}
function scheduleReveal(i) {
  if (revealTimers.has(i)) return;
  const owner = session;
  feedback[i] = false;
  revealTimers.set(
    i,
    setTimeout(() => {
      revealTimers.delete(i);
      if (
        session !== owner ||
        revealRemaining(session.c, session.attempts, i) === null
      )
        return;
      session.autoRevealed.add(i);
      feedback[i] = "auto";
      delete pending[i];
      keepCompletedOpen(i);
      persist();
      if (view === "activity") {
        renderActivityStable();
        announceFeedback(i);
      }
    }, 1000),
  );
}
function answerFeedback(i) {
  const { c, attempts } = session;
  const points = !prefs.hideScores
    ? ` ${fmt(rowScore(c, attempts, i))} points.`
    : "";
  if (feedback[i] === "auto")
    return `${letters[c.answers[i]]} revealed automatically—the only remaining answer.${points}`;
  if (remainingAnswer(c, attempts, i) !== null)
    return `Question ${c.startNumber + i}: Incorrect. Only one choice remains.`;
  return `Question ${c.startNumber + i}: ${feedback[i] ? "Correct." + points : "Incorrect. Try another answer."}`;
}
function announceFeedback(i) {
  const element = $("#feedback-" + i);
  if (!element) return;
  element.textContent = "";
  requestAnimationFrame(() => {
    if (element.isConnected) element.textContent = answerFeedback(i);
  });
}

function positionConfirm(i) {
  const row = $("#confirm-" + i);
  if (!row || row.hidden || pending[i] === undefined || !session) return;
  const choice = document.querySelector(
    `[data-question="${i}"][data-choice="${pending[i]}"]`,
  );
  if (!choice) return;
  const button = row.querySelector("button"),
    bounds = row.getBoundingClientRect(),
    anchor = choice.getBoundingClientRect();
  button.style.marginLeft =
    confirmationLeft(
      anchor.left - bounds.left,
      anchor.width,
      button.getBoundingClientRect().width,
      bounds.width,
      pending[i],
      session.c.choiceCount,
    ) + "px";
}
function positionConfirmations() {
  if (view !== "activity") return;
  for (const i of Object.keys(pending)) positionConfirm(Number(i));
}
new ResizeObserver(positionConfirmations).observe(app);
document.fonts.ready.then(positionConfirmations);
function requireCompletedActivity() {
  if (isComplete(session.c, session.attempts)) return true;
  if (!session.preview && location.hash.startsWith("#/results/"))
    history.replaceState(null, "", "#/activity/" + session.token);
  renderActivity();
  return false;
}
function selectChoice(i, j) {
  if (remainingAnswer(session.c, session.attempts, i) !== null) return;
  navigationCursor = i;
  if (prefs.confirm) {
    pending[i] = j;
    const section = $("#question-" + i);
    for (const b of section.querySelectorAll("[data-question]"))
      if (!b.disabled) {
        b.classList.toggle("selected", +b.dataset.choice === j);
        b.setAttribute("aria-pressed", String(+b.dataset.choice === j));
      }
    const row = $("#confirm-" + i);
    row.hidden = false;
    row.querySelector("button").textContent = "Confirm " + letters[j];
    positionConfirm(i);
  } else commitChoice(i, j);
}
function commitChoice(i, j) {
  const { c, attempts } = session;
  if (
    !Number.isInteger(j) ||
    j < 0 ||
    j >= c.choiceCount ||
    attempts[i].includes(j) ||
    attempts[i].includes(c.answers[i]) ||
    remainingAnswer(c, attempts, i) !== null
  )
    return;
  attempts[i].push(j);
  navigationCursor = i;
  delete pending[i];
  feedback[i] = j === c.answers[i];
  if (feedback[i]) keepCompletedOpen(i);
  persist();
  renderActivity();
  announceFeedback(i);
  const section = $("#question-" + i);
  const target =
    section.querySelector("button:not(:disabled)") ||
    section.querySelector("h2");
  target.setAttribute("tabindex", target.tagName === "BUTTON" ? "0" : "-1");
  target.focus({ preventScroll: true });
}
function renderResults() {
  if (!requireCompletedActivity()) return;
  view = "results";
  const { c, attempts } = session;
  setView("Results");
  app.innerHTML =
    heading() +
    `<div class="summary"><span>Total <strong class="score">${fmt(totalScore(c, attempts))} / ${fmt(maximum(c))}</strong></span><span class="muted">Results</span></div><ul class="report-list">${c.answers
      .map((answer, i) => {
        const tried = attempts[i],
          done = tried.includes(answer);
        return `<li><strong>Q${c.startNumber + i}</strong><span class="attempts">${tried.length ? tried.map((a) => `<span class="${a === answer ? "correct-text" : "wrong-text"}">${letters[a]} ${feedbackSymbol(a === answer)}<span class="sr-only"> ${a === answer ? "Correct" : "Incorrect"}</span>${a === answer && session.autoRevealed.has(i) ? ' <span class="auto-label">(automatic reveal)</span>' : ""}</span>`).join(" → ") : "Unanswered"}${tried.length && !done ? " · Unfinished" : ""}</span><strong>${fmt(rowScore(c, attempts, i))} / ${fmt(c.points[0])}</strong></li>`;
      })
      .join(
        "",
      )}</ul><div class="toolbar"><button id="pdf">Download PDF</button><button id="back" class="secondary">Back to activity</button></div><p class="muted export-note">Results reflect attempts saved in this browser. PDFs use a white background.</p>`;
  wirePreview();
  $("#back").onclick = () => {
    if (session.preview) renderActivity();
    else location.hash = `/activity/${session.token}`;
  };
  $("#pdf").onclick = () => runExport("pdf", exportPDF);
}
async function runExport(id, fn) {
  if (!requireCompletedActivity()) return;
  const b = $("#" + id);
  b.disabled = true;
  const label = b.textContent;
  b.textContent = "Preparing…";
  try {
    await fn(session);
    toast("Export ready.");
  } catch (e) {
    toast("Could not export: " + e.message);
  } finally {
    b.disabled = false;
    b.textContent = label;
  }
}
async function route() {
  const generation = ++routeGeneration;
  const hash = location.hash.slice(1) || "/";
  if (hash === "/") {
    landing();
    return;
  }
  if (hash === "/create") {
    creator();
    return;
  }
  if (hash === "/example") {
    example();
    return;
  }
  const match = hash.match(/^\/(activity|results|edit)\/([\w-]+)$/);
  if (!match) {
    showError("This page could not be found.");
    return;
  }
  app.innerHTML = '<p class="muted" role="status">Opening activity…</p>';
  try {
    const [, mode, token] = match,
      c = await decode(token, mode === "edit" ? "edit" : "activity"),
      id = await activityId(c);
    if (generation !== routeGeneration) return;
    if (mode === "edit") {
      draft = c;
      storeDraft();
      creator();
      return;
    }
    if (!session || session.id !== id || session.preview)
      startSession(c, token, false, id);
    else session.token = token;
    if (mode === "results") renderResults();
    else renderActivity();
  } catch (e) {
    if (generation === routeGeneration)
      showError(
        "This activity link is invalid, incomplete, or unsupported. " +
          (e.message.includes("browser")
            ? e.message
            : "Please ask your instructor for the full link."),
      );
  }
}
function showError(message) {
  clearSessionTimers();
  session = null;
  view = "error";
  setView("Unable to open activity");
  app.innerHTML = `<h1>Unable to open activity</h1><p role="alert">${esc(message)}</p><a href="#/create">Create an activity</a>`;
}
window.addEventListener("hashchange", route);
window.addEventListener("storage", (e) => {
  if (session && !session.preview && e.key === "sf.activity." + session.id) {
    const stored = read(e.key, {});
    session.attempts = sanitizeAttempts(session.c, stored.attempts);
    session.autoRevealed = restoreAutomaticReveals(
      session.c,
      session.attempts,
      stored.autoRevealed,
    );
    pending = {};
    feedback = {};
    for (const i of session.autoRevealed) feedback[i] = "auto";
    if (view === "activity") renderActivity();
    else if (view === "results") renderResults();
    toast("Progress updated from another tab.");
  }
});
route();
