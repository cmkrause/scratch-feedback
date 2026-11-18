# Scratch Feedback

A minimal, mobile-friendly, browser-only answer sheet for instant feedback and partial credit. Independently written, inspired by Steven Clontz's [Scratchee](https://github.com/StevenClontz/scratchee); not affiliated with the original project.

## Use

The homepage introduces the project and offers **Create an activity** (`#/create`) and a fresh, unsaved **Try an example** (`#/example`). Open the creator to configure an activity. Set 1–200 questions, 2–10 answer choices, starting number, points by successful attempt, and the complete key. Share the activity link or QR code; retain the edit link to revise it. Question text is supplied separately. Preview attempts are temporary.

Students can confirm selections, switch between all questions and one-at-a-time, choose system/light/dark appearance, and hide scores while answering. Hidden scores are omitted from the live total, question rows, and answer announcements; results and PDFs still include scoring. Confirmed attempts are saved in this browser. Correct answers lock a question. There is no reset control. Results and PDF export are available only after every question has been completed by finding its correct answer; direct results links are subject to the same check. Confirmation is positioned beneath the selected choice, and answer feedback appears within its question. When only one choice remains, selections lock for one second before that choice is revealed automatically, earning the configured last-attempt credit. Automatic reveals are recorded in saved progress, results, and PDFs. Completed questions remain expanded for two seconds, then collapse in all-questions mode; tap their heading to review locked attempts. One-question mode keeps completed questions open. **Go to next unfinished question** cycles through not-started and incomplete questions. The reveal fade respects reduced-motion preferences. Pending reveals resume if the activity is reopened. No student/group name is collected or included in reports. Results include attempts in order and can be exported as selectable-text PDF. Correct/incorrect feedback uses color-inheriting text symbols (✓ / ×) and accessible text alternatives.

## Hosting and development

Static HTML/CSS/JavaScript: no build, database, external font service, or backend. GitHub Pages publishes `main` from the repository root. Asset paths work under a repository subdirectory. When changing JavaScript or CSS, bump the asset version in `index.html` and module imports together so browsers load matching files. The developer preview at `tests/responsive.html` exercises phone and tablet widths.

Serve over HTTPS (or localhost) for Web Crypto and clipboard access. Locally: `python3 -m http.server 8000`, then open localhost:8000. Run core regression checks with `npm test` (Node 22+).

## Configuration links and privacy

Version 1 links contain a normalized JSON configuration, optionally DEFLATE-compressed, encrypted using AES-256-GCM with a fresh random key and 96-bit IV, then Base64url encoded. The key is included in the URL fragment: this is obfuscation, not secrecy or instructor authentication. A knowledgeable visitor can recover or modify the key and configuration through developer tools. No correctness metadata is attached to unattempted answer buttons. Answer checking requires decrypted answers in JavaScript memory.

Progress uses SHA-256 of the normalized configuration as its local storage identifier. Equivalent configurations share progress even when ciphertext differs; configuration edits create new identities. Appearance and display preferences are separate. Storage can be cleared or modified and is not synchronized across devices. Exports are student-generated, not verified submissions. Attempts stay in browser storage and downloads; the app sends no analytics or submissions. Hosting providers still receive ordinary page/asset requests. Do not store real exam configurations or student records in the repository.

Keep the site URL and version 1 decoding support stable to preserve previously shared links. A host/origin change will not migrate local browser progress.

## Third-party assets

- Atkinson Hyperlegible Next by the Braille Institute / Applied Design Works, SIL Open Font License; see `assets/fonts/OFL.txt`. Static regular font derived from the variable font for PDF embedding.
- jsPDF 3.0.4, MIT; see `assets/vendor/jsPDF-LICENSE.txt` and source header.
- qrcode-generator 1.4.4 by Kazuhiko Arase, MIT; license included in source header.

All dependencies are vendored to avoid third-party runtime requests.
