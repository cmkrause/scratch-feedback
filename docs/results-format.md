# Scratch Feedback results format

Completed PDF exports contain one UTF-8 JSON attachment named `scratch-feedback-results.json` with MIME type `application/json`. Extract it from the original downloaded PDF. Printing to PDF or converting the file can discard attachments.

New exports use [version 2](../schemas/results-v2.schema.json). See the [complete example](results-v2.example.json). Older PDFs use [version 1](results-format-v1.md), which has its own [schema](../schemas/results-v1.schema.json) and [example](results-v1.example.json).

## Reading an export

Extract the named attachment with a PDF library, parse it as JSON, check that `format` is `scratch-feedback-results`, and validate it against the schema for its integer `schemaVersion`. The [version 1 guide](results-format-v1.md#read-an-exported-pdf) shows how to extract the attachment with Python and pypdf. Select the validator according to the actual version.

| Field | Meaning |
| --- | --- |
| `generatedAt` | UTC export timestamp from the exporting device. |
| `mode` | `activity`, `example`, or `preview`. |
| `activity` | Full student URL, full configuration SHA-256 hash, title, and points by successful attempt. |
| `summary` | Numeric `pointsEarned` and `pointsPossible` totals. |
| `questions` | Questions in their original order, with displayed number, ordered choice letters, `automaticReveal`, and numeric `pointsEarned`. |

Each exported question is complete. The final choice is correct, and earlier choices are incorrect. If `automaticReveal` is true, the final choice was revealed by the app after every other choice was tried. Tentative selections and cancellations are excluded. Attempt numbers follow array order. The first scoring entry is the possible points for every question. Question count, starting number, and choice count follow from the question array, its first number, and the scoring array length.

For consistency checks, verify consecutive question numbers, distinct choices within the configured range, and a positive first scoring entry followed by nonnegative, nonincreasing entries. Each question's earned points should match the scoring entry for its final attempt. Automatic reveals use the full choice count. Totals should match the sum of earned points and the first scoring entry multiplied by the question count, allowing normal floating-point rounding.

Use the full configuration hash to group reports. Separate encoded links can represent the same configuration. The [hashing procedure](results-format-v1.md#activity-fields) and the activity-link format are shared across both versions. Descriptions remain available in the full activity link and the visible PDF.

The attachment includes the full link, from which the answer key can be recovered. Reports are unsigned student-generated records. Treat the hash as a configuration fingerprint and compare it against an instructor-held reference when needed.
