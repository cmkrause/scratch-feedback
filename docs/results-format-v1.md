# Results JSON format

Every completed PDF downloaded by Scratch Feedback embeds **`scratch-feedback-results.json`**, with MIME type **`application/json`**, as a standard PDF file attachment. The visible report and attached data are generated from the same immutable export snapshot. Nothing is uploaded to a backend. Student names are not collected, and no short activity ID is displayed or exported.

- Format identifier: `scratch-feedback-results`
- Schema version: integer `1`
- Formal schema: [`../schemas/results-v1.schema.json`](../schemas/results-v1.schema.json), JSON Schema draft 2020-12
- Published schema: <https://cmkrause.github.io/scratch-feedback/schemas/results-v1.schema.json>
- Example: [`results-v1.example.json`](results-v1.example.json)

## Read an exported PDF

A program should enumerate the PDF's embedded files, extract the exact attachment name above, decode its bytes as UTF-8, and parse the JSON. PDF readers with an Attachments panel can also extract it manually. No OCR or page-layout interpretation is needed. A missing attachment means the file is an older export, was reprinted/converted, or is not a supported results file; do not guess its data from arbitrary PDF properties.

For example, using Python and `pypdf`:

```python
import json
from pypdf import PdfReader

reader = PdfReader("activity-results.pdf")
files = reader.attachments.get("scratch-feedback-results.json", [])
if len(files) != 1:
    raise ValueError("Expected exactly one results JSON attachment")
results = json.loads(files[0].decode("utf-8"))
if results["format"] != "scratch-feedback-results" or results["schemaVersion"] != 1:
    raise ValueError("Unsupported results format")
# Validate against the version 1 schema, then perform the semantic checks below.
```

Keep the **original downloaded PDF**. Printing it into another PDF, taking a screenshot, or converting it through another service can remove attachments. Embedded data is unobtrusive, not secret, and is not included in ordinary printing.

## Top-level fields

| Field           | Meaning                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `format`        | Fixed format identifier.                                                                         |
| `schemaVersion` | Version of this results contract; independent of the activity-link format.                       |
| `generatedAt`   | Export time as an ISO 8601 UTC timestamp, from the exporting device's clock.                     |
| `mode`          | `activity`, `example`, or `preview`. Importers can exclude practice exports.                     |
| `activity`      | Full link, configuration fingerprint, title/instructions, numbering, choices, and scoring rules. |
| `summary`       | Completion and total scores. Only completed activities can be exported.                          |
| `questions`     | All questions, in their original order, including ordered attempts and per-question scores.      |

## Activity fields

`activity.url` is a full, self-contained **student activity link**, including its complete encoded payload. It points to `#/activity/...`, not an editor or results page. For regular activities, the original payload is preserved. For an unsaved example or editor preview, the exporter generates a reopenable link from the configuration; `mode` still identifies the export as practice. The full link intentionally permits recovery of the configuration and answer key.

`activity.configurationHash` is the full lowercase **SHA-256** hex digest (64 characters). Use this field to group equivalent activity configurations, not the URL, title, or a shortened ID. Different randomly encrypted links can represent the same configuration and have the same hash. The hash identifies the configuration, not the student's attempts, and is not a signature.

Hashing follows the existing `activityId()` contract in [`core.js`](../core.js): normalize with `normalize()`, serialize with JavaScript `JSON.stringify()`, encode as UTF-8, then SHA-256. The normalized object has these properties in this exact order:

```text
version, title, description, startNumber, choiceCount, points, answers
```

`title` and `description` are trimmed; `answers` uses zero-based numeric choices. This is the app's serialization contract, **not RFC 8785 canonical JSON**. A cross-language implementation must match JavaScript string/number serialization to recompute the digest. The normalized configuration can be recovered from the full activity link. Importers can compare supplied full hashes without decoding links.

Other fields are `title`, `description`, `startNumber`, `questionCount`, `choiceCount`, and `pointsByAttempt`. For example, `[6, 2, 1, 0]` awards 6 points for success on attempt 1, 2 on attempt 2, and so on. Choices are the first `choiceCount` letters A-J. Scores are numbers, not formatted strings or percentages. JSON preserves numeric scoring values; display text is formatted to at most four fractional digits. Allow for normal floating-point rounding when recomputing totals.

## Questions and attempts

Each question contains:

- `number`: displayed question number (not a zero-based index).
- `attempts`: confirmed outcomes in chronological order within that question.
- `automaticReveal`: whether the final correct answer was revealed automatically.
- `pointsEarned` and `pointsPossible`: numeric per-question scores.

Each attempt contains `attempt` (one-based position), `choice` (uppercase letter), `correct` (boolean), and `source` (`student` or `automatic`). Tentative selections, switching a tentative selection, and Cancel are **not attempts**. No attempt timestamps are inferred or collected.

An automatic reveal is appended as the final attempt after all other choices were tried. It has `correct: true`, `source: "automatic"`, and the question has `automaticReveal: true`. Its credit is the configured **last-attempt** score, which need not be zero. A manually selected correct answer has `source: "student"`.

## Validation beyond JSON Schema

The schema checks field types, bounds, supported versions, and basic structure. Importers should also check:

1. Question counts equal the lengths/counts declared in `activity` and `summary`; `summary.complete` is true.
2. Question numbers are consecutive, starting at `activity.startNumber`.
3. Each attempt number is consecutive from 1; choices are within `choiceCount`, unique within a question, and no question has more attempts than choices.
4. Each question ends with exactly one correct attempt, with all prior attempts incorrect.
5. `pointsByAttempt` has `choiceCount` entries, starts positive, is nonnegative, and never increases.
6. Question credit matches the entry for the successful attempt; possible credit equals the first entry. Summary scores equal the sums over questions.
7. `automaticReveal` agrees with attempt sources. An automatic attempt is final, correct, and present only after all other choices were tried.
8. When validating provenance against a known exam, decode the activity link, recompute the configuration hash, and compare it to an instructor-held expected configuration. A consistent embedded link/hash is not proof of instructor approval.

Version 1 uses `additionalProperties: false`. Unknown schema versions should be rejected or explicitly handled, not interpreted as version 1. Breaking contract changes require a new version and schema file; existing version 1 documentation and schema should remain available.

## Trust and privacy

These are **student-generated, unsigned records**. A knowledgeable person can edit the JSON, the PDF, or browser storage, or create a different activity. Neither the configuration hash nor matching visible/embedded scores authenticates a submission. Schema validation establishes structure, not trust.

The attachment includes no name, student identifier, browser identifier, IP address, reset count, or invented attempt timing. It does include the full activity link and completed answers. Treat those as intentional shared data. The visible PDF contains the title, export date, attempts, and scores, but neither the full hash nor a short ID.
