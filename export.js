import {
  letters,
  rowScore,
  totalScore,
  maximum,
  fmt,
  isComplete,
} from "./core.js?v=1.2.0";
function report(session) {
  const { c, attempts, id, preview } = session;
  return {
    title: c.title,
    id: preview ? "Preview" : id.slice(0, 10),
    date: new Date().toLocaleString(),
    score: `${fmt(totalScore(c, attempts))} / ${fmt(maximum(c))}`,
    description: c.description,
    rows: c.answers.map((answer, i) => ({
      question: `Question ${c.startNumber + i}`,
      attempts: attempts[i].length
        ? attempts[i]
            .map(
              (a) =>
                `${letters[a]} (${a === answer ? "Correct" : "Incorrect"})`,
            )
            .join(" → ") + (attempts[i].includes(answer) ? "" : " · Unfinished")
        : "Unanswered",
      points: `${fmt(rowScore(c, attempts, i))} / ${fmt(c.points[0])}`,
    })),
  };
}
function filename(session) {
  return (
    (session.c.title
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "activity") + "-results"
  );
}
let fontPromise;
async function font64() {
  fontPromise ??= fetch("assets/fonts/atkinson-next-regular.ttf")
    .then((r) => {
      if (!r.ok) throw Error("Report font unavailable.");
      return r.arrayBuffer();
    })
    .then((buffer) => {
      let s = "";
      for (const b of new Uint8Array(buffer)) s += String.fromCharCode(b);
      return btoa(s);
    });
  return fontPromise;
}
export async function exportPDF(session) {
  if (!isComplete(session.c, session.attempts))
    throw Error("Complete every question before downloading results.");
  if (!window.jspdf)
    throw Error("PDF library unavailable. Reload and try again.");
  const r = report(session),
    doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("Atkinson.ttf", await font64());
  doc.addFont("Atkinson.ttf", "Atkinson", "normal");
  doc.setFont("Atkinson");
  let y = 20;
  const margin = 18,
    width = 174,
    bottom = 275;
  function newPage() {
    doc.addPage();
    y = 20;
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text("Scratch Feedback · " + r.id, margin, y);
    y += 10;
  }
  function text(value, size = 11, color = 25) {
    doc.setFontSize(size);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(String(value), width);
    for (const line of lines) {
      if (y + size * 0.45 > bottom) {
        newPage();
        doc.setFontSize(size);
        doc.setTextColor(color);
      }
      doc.text(line, margin, y);
      y += size * 0.45 + 1;
    }
    y += 2;
  }
  text(r.title, 21);
  text(`Activity ${r.id} · ${r.date}`, 9, 90);
  text(`Total score: ${r.score}`, 16);
  if (r.description) text(r.description, 10, 70);
  y += 3;
  for (const row of r.rows) {
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(row.attempts, width - 4);
    const height = lines.length * 6 + 19;
    if (y + height > bottom) newPage();
    text(`${row.question}    ${row.points} points`, 12);
    text(row.attempts.replaceAll(" → ", " > "), 11);
    doc.setDrawColor(215);
    doc.line(margin, y, width + margin, y);
    y += 7;
  }
  text("Student-generated record of attempts saved in this browser.", 9, 100);
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`${i} / ${pages}`, 192, 287, { align: "right" });
  }
  doc.save(filename(session) + ".pdf");
}
