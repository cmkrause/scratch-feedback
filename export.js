import { letters, rowScore, totalScore, maximum, fmt } from "./core.js?v=1.0.1";
function report(session) {
  const { c, attempts, name, id, preview } = session;
  return {
    title: c.title,
    name: name || "",
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
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
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
  if (r.name) text(r.name, 13);
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
function wrap(ctx, text, width) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    if (
      ctx.measureText((line ? line + " " : "") + word).width > width &&
      line
    ) {
      lines.push(line);
      line = "";
    }
    if (ctx.measureText(word).width > width) {
      for (const char of word) {
        if (ctx.measureText(line + char).width > width) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    } else line += (line ? " " : "") + word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
export async function exportPNG(session) {
  await document.fonts.load("24px Atkinson");
  const r = report(session),
    width = 1240,
    height = 1754,
    pad = 82;
  const canvases = [];
  let canvas, ctx, y;
  function page() {
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    y = pad;
    canvases.push(canvas);
  }
  function line(text, size = 25, color = "#202322") {
    ctx.font = `${size}px Atkinson`;
    const lines = wrap(ctx, text, width - 2 * pad);
    for (const l of lines) {
      if (y + size * 1.5 > height - pad) {
        page();
        ctx.font = `${size}px Atkinson`;
      }
      ctx.fillStyle = color;
      ctx.fillText(l, pad, y + size);
      y += size * 1.5;
    }
    y += 12;
  }
  page();
  line(r.title, 44);
  if (r.name) line(r.name, 30);
  line(`Activity ${r.id} · ${r.date}`, 20, "#606662");
  line(`Total score: ${r.score}`, 36);
  if (r.description) line(r.description, 23, "#606662");
  y += 15;
  for (const row of r.rows) {
    ctx.font = "25px Atkinson";
    const count = wrap(ctx, row.attempts, width - 2 * pad).length;
    if (y + count * 38 + 110 > height - pad) page();
    line(`${row.question}     ${row.points} points`, 28);
    line(row.attempts, 25);
    ctx.strokeStyle = "#d4d9d5";
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
    y += 25;
  }
  line(
    "Student-generated record of attempts saved in this browser.",
    20,
    "#606662",
  );
  const blobs = await Promise.all(
    canvases.map((c, i) => {
      const x = c.getContext("2d");
      x.font = "20px Atkinson";
      x.fillStyle = "#606662";
      x.fillText(
        `${i + 1} / ${canvases.length}`,
        width - pad - 65,
        height - 32,
      );
      return new Promise((resolve, reject) =>
        c.toBlob(
          (b) => (b ? resolve(b) : reject(Error("Could not create image."))),
          "image/png",
        ),
      );
    }),
  );
  // A single download avoids mobile browsers blocking multiple files.
  if (blobs.length === 1) {
    download(blobs[0], filename(session) + ".png");
    return;
  }
  // Uncompressed ZIP with CRC32, keeping long reports in manageable page-sized images.
  const entries = [];
  for (let i = 0; i < blobs.length; i++)
    entries.push({
      name: `${filename(session)}-${i + 1}.png`,
      bytes: new Uint8Array(await blobs[i].arrayBuffer()),
    });
  download(zip(entries), filename(session) + "-png.zip");
}
function zip(entries) {
  const parts = [],
    central = [];
  let offset = 0;
  const enc = new TextEncoder();
  for (const { name, bytes } of entries) {
    const n = enc.encode(name);
    let crc = 0xffffffff;
    for (const b of bytes) {
      crc ^= b;
      for (let k = 0; k < 8; k++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = new Uint8Array(30 + n.length),
      v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, bytes.length, true);
    v.setUint32(22, bytes.length, true);
    v.setUint16(26, n.length, true);
    local.set(n, 30);
    parts.push(local, bytes);
    const c = new Uint8Array(46 + n.length),
      d = new DataView(c.buffer);
    d.setUint32(0, 0x02014b50, true);
    d.setUint16(4, 20, true);
    d.setUint16(6, 20, true);
    d.setUint32(16, crc, true);
    d.setUint32(20, bytes.length, true);
    d.setUint32(24, bytes.length, true);
    d.setUint16(28, n.length, true);
    d.setUint32(42, offset, true);
    c.set(n, 46);
    central.push(c);
    offset += local.length + bytes.length;
  }
  const size = central.reduce((s, c) => s + c.length, 0),
    end = new Uint8Array(22),
    d = new DataView(end.buffer);
  d.setUint32(0, 0x06054b50, true);
  d.setUint16(8, entries.length, true);
  d.setUint16(10, entries.length, true);
  d.setUint32(12, size, true);
  d.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
