import { fmt, isComplete } from "./core.js?v=1.6.0";
import { buildResults, RESULTS_ATTACHMENT_NAME } from "./results.js?v=1.6.0";

let fontPromise;
async function fontBytes() {
  fontPromise ??= fetch("assets/fonts/atkinson-next-regular.ttf")
    .then((r) => {
      if (!r.ok) throw Error("Report font unavailable.");
      return r.arrayBuffer();
    })
    .then((bytes) => new Uint8Array(bytes))
    .catch((error) => {
      fontPromise = undefined;
      throw error;
    });
  return fontPromise;
}
function base64(bytes) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

// PDF text and the embedded file both come exclusively from this results snapshot.
export async function createResultsPdf(results, { jsPDF, PDFDocument, font, description = "" }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("Atkinson.ttf", base64(font));
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
    doc.text("Scratch Feedback", margin, y);
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
  text(results.activity.title, 21);
  text(new Date(results.generatedAt).toLocaleString(), 9, 90);
  text(
    `Total score: ${fmt(results.summary.pointsEarned)} / ${fmt(results.summary.pointsPossible)}`,
    16,
  );
  if (description) text(description, 10, 70);
  y += 3;
  for (const row of results.questions) {
    const attempts = row.attempts
      .map(
        (choice, i) =>
          `${choice} (${i === row.attempts.length - 1 ? (row.automaticReveal ? "Correct, automatic reveal" : "Correct") : "Incorrect"})`,
      )
      .join(" > ");
    doc.setFontSize(11);
    const height = doc.splitTextToSize(attempts, width - 4).length * 6 + 19;
    if (y + height > bottom) newPage();
    text(
      `Question ${row.number}    ${fmt(row.pointsEarned)} / ${fmt(results.activity.pointsByAttempt[0])} points`,
      12,
    );
    text(attempts, 11);
    doc.setDrawColor(215);
    doc.line(margin, y, width + margin, y);
    y += 7;
  }
  text(
    results.mode === "activity"
      ? "Student-generated record of attempts saved in this browser."
      : "Practice activity; attempts are not saved.",
    9,
    100,
  );
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`${i} / ${pages}`, 192, 287, { align: "right" });
  }
  const pdf = await PDFDocument.load(doc.output("arraybuffer"), {
    updateMetadata: false,
  });
  const date = new Date(results.generatedAt);
  await pdf.attach(
    new TextEncoder().encode(JSON.stringify(results, null, 2) + "\n"),
    RESULTS_ATTACHMENT_NAME,
    {
      mimeType: "application/json",
      description:
        `Machine-readable Scratch Feedback results, schema version ${results.schemaVersion}`,
      creationDate: date,
      modificationDate: date,
    },
  );
  return pdf.save();
}
export async function exportPDF(session) {
  if (!isComplete(session.c, session.attempts))
    throw Error("Complete every question before downloading results.");
  const description = session.c.description.trim();
  const results = await buildResults(session, { baseUrl: location.href });
  if (!window.jspdf || !window.PDFLib)
    throw Error("PDF libraries unavailable. Reload and try again.");
  const bytes = await createResultsPdf(results, {
    jsPDF: window.jspdf.jsPDF,
    PDFDocument: window.PDFLib.PDFDocument,
    font: await fontBytes(),
    description,
  });
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/pdf" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download =
    (results.activity.title
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "activity") + "-results.pdf";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
