# Scratch Feedback

[Open the site](https://cmkrause.github.io/scratch-feedback/) · [Try an example](https://cmkrause.github.io/scratch-feedback/#/example)

A minimal, mobile-friendly answer sheet for instant feedback and partial credit. Scratch Feedback runs entirely in the browser, with no accounts, database, backend, or Canvas integration. It is independently written, inspired by Steven Clontz's [Scratchee](https://github.com/StevenClontz/scratchee), and is not affiliated with the original project.

## Create and share an activity

1. Choose **Create an activity** from the homepage.
2. Set the title/instructions, number of questions (1–200), starting number, answer choices (2–10), points for each attempt, and answer key. Question text is supplied separately.
3. Share the student activity link or QR code. Keep the separate edit link if you want to revise the configuration; changes create a different activity.

Each link carries the complete configuration, so creating a new activity does not require publishing files or updating this repository. The homepage's **Try an example** is a fresh, unsaved practice session. Editor previews are also temporary.

## Student experience

- Large touch targets, Atkinson Hyperlegible Next, and system/light/dark appearance.
- Color-inheriting check/cross symbols, accessible text alternatives, keyboard controls, and reduced-motion support.
- Optional confirmation: students can change their tentative choice within the current question or cancel without recording an attempt. Other questions and navigation remain locked until Confirm or Cancel.
- All questions or one question at a time, plus **Go to next unfinished question**.
- Optional hidden live scoring; results and PDF exports still include scores.
- Immediate feedback and partial credit. The final remaining choice is revealed automatically after a one-second pause and earns the configured last-attempt score. Automatic reveals are labeled in results and PDFs.
- Completed questions collapse after two seconds in all-questions mode; tap their heading to review locked attempts. One-question mode keeps completed questions open.
- Confirmed progress is saved in the current browser, including automatic reveals. Pending reveals resume when reopened. There is no reset control.
- Results and PDF export unlock only after every question's correct answer is found. No student/group name is collected, and no short activity ID is shown.

## PDF exports and machine-readable results

Each downloaded PDF includes the readable report and a UTF-8 JSON attachment named **`scratch-feedback-results.json`**. Both are generated from the same results snapshot. The attachment records the full activity link, full configuration SHA-256 hash, ordered attempts, automatic reveals, and numeric scores. Programs can extract it without OCR.

- [Results format and importer guidance](docs/results-format.md)
- [Version 2 JSON Schema](schemas/results-v2.schema.json)
- [Complete example results JSON](docs/results-v2.example.json)

Keep the original downloaded PDF; printing/conversion can discard the attachment. Results are student-generated and unsigned. Neither the PDF nor embedded JSON is proof of an independently verified submission.

## Hosting and development

Plain HTML, CSS, and JavaScript, with no build step. GitHub Pages publishes `main` from the repository root; `.nojekyll` serves static assets directly. The creator is at `#/create`, the practice example at `#/example`, and shared activity/edit links remain self-contained.

Serve over HTTPS (or localhost) for Web Crypto and clipboard access:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. The developer preview at `tests/responsive.html` exercises phone/tablet widths. After JavaScript or CSS changes, bump the asset version in `index.html` and module imports together to avoid stale browser caches.

With Node 22+:

```sh
npm ci
npm test
```

Tests cover configuration links, scoring, automatic completion, results schema validation, snapshots, and extraction of the actual JSON attachment from single/multi-page generated PDFs. Ajv and ajv-formats are development-only schema validators; browsers do not download them.

## Configuration links and privacy

Version 1 activity links contain normalized JSON, optionally DEFLATE-compressed, encrypted with AES-256-GCM using a fresh random key and 96-bit IV, then Base64url encoded. The decoding key is included in the URL fragment: this provides **obfuscation, not secrecy or authentication**. A knowledgeable visitor can recover or modify the configuration and browser state. No correctness metadata is attached to unattempted answer elements; client-side checking requires decrypted answers in JavaScript memory.

Progress uses the full SHA-256 hash of the normalized configuration as its local-storage key. Equivalent configurations share progress even if their encrypted URLs differ. This internal fingerprint is also included in the results attachment for matching reports; it is not displayed to students. Configuration edits create new identities. Display preferences are separate.

The app sends no analytics or submissions. Attempts stay in browser storage and downloads; hosting providers receive normal page/asset requests. Storage can be cleared/modified and is not synchronized across devices. Do not commit real exam configurations or student records to this repository. Embedded JSON intentionally includes a full activity link from which the answer key can be recovered.

Keep the published site address and existing link-decoding support stable to preserve shared links. Changing the host/origin does not migrate saved browser progress.

## Third-party assets

All browser dependencies and fonts are vendored locally; no third-party runtime requests are needed.

- **Atkinson Hyperlegible Next**, Braille Institute / Applied Design Works, SIL Open Font License: [license](assets/fonts/OFL.txt). A static regular font is derived for PDF embedding.
- **jsPDF 3.0.4**, MIT: [license](assets/vendor/jsPDF-LICENSE.txt). Generates the readable PDF pages.
- **PDF-LIB 1.17.1**, MIT: [license](assets/vendor/pdf-lib-LICENSE.md). Embeds the JSON attachment.
- **qrcode-generator 1.4.4**, Kazuhiko Arase, MIT: [license](assets/vendor/qrcode-LICENSE.txt).
