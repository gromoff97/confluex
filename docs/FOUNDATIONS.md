# Requirements Foundations

## 1. Document Purpose


This document defines the black-box functional requirements for `confluex`.
It is intended to be strong enough for design, implementation, review, and
acceptance of the CLI without relying on source-code inspection, README text, or
informal project knowledge.

The intended customer context is a user or automation pipeline that needs to:

- export a Confluence root page and its recursive child tree;
- include supported internally linked pages without silently guessing unsupported
  semantics;
- receive deterministic machine-readable artifacts and outcomes;
- distinguish the exact final outcomes `success`, `success_with_findings`,
  `policy_failed`, `interrupted`, `incomplete`, and `encryption_failed`;
- resume eligible export work safely;
- deliver results in encrypted form when required.

## 2. Requirement Quality Contract (CIRCUS MATTA)


This document is intentionally written to satisfy CIRCUS MATTA for black-box CLI
requirements:

- **Completeness**: it covers command surface, options, validation, diagnostics,
  configuration, lifecycle, traversal, data acquisition, artifact layout,
  reporting, safety, interruption, recovery, encryption, observability, and exit
  codes.
- **Independent**: each `FR-*` requirement package describes one primary
  externally observable contract.
- **Realisable** and **Achievable**: requirements constrain product behavior, not
  hidden implementation strategy.
- **Consistency**: one vocabulary is used for commands, options, files, report
  names, status tokens, and result semantics.
- **Unambiguity**: operator-visible behavior, persisted artifacts, and
  machine-readable contracts are stated explicitly.
- **Specific**: the requirements describe a deterministic, security-aware,
  automation-friendly Confluence export CLI rather than a generic content tool.
- **Measurable** and **Testable**: every requirement is written so that
  conformance can be determined from invocations and observable outputs.
- **Acceptable**: requirements preserve operator value and product intent rather
  than accidental implementation detail.
- **Traceable**: each requirement has a stable identifier, explicit dependencies,
  and an observable evidence target.

## 3. Reading Rules


The following reading rules are normative for this document:

- Requirements describe only externally observable behavior.
- If two requirements overlap, the more specific requirement prevails.
- A listed `Dependencies` entry means the dependent requirement relies on the
  referenced requirement for interpretation, acceptance, or outcome derivation;
  it does not relax or override the dependent requirement's own text.
- `Dependencies` lists identify the minimum direct normative prerequisites used
  by a requirement and are not required to enumerate every related requirement
  in the document.
- Exact literals in backticks are normative when they define commands, options,
  file names, directory names, headings, report headers, summary keys, closed
  token vocabularies, or complete operator-visible machine-readable lines.
- Free-text explanatory fields such as `error_summary`, `detail`, and
  line-by-line persistent log content are not fixed verbatim unless a requirement
  explicitly fixes them.
- A rejected invocation is an invocation that exits non-zero before traversal,
  payload export, attachment download, report generation, output-root reuse,
  configuration mutation, installation writes, or uninstallation writes begin.
- A command begins command work when it first performs any externally observable
  behavior other than rendering help output or reporting a rejected invocation.
- A canonical page identifier is the unsigned base-10 page-id string containing
  only ASCII digits `0` through `9`, with no sign, no separators, and no leading
  zeroes unless the value is exactly `0`.
- A positive integer is an unsigned base-10 integer string containing only ASCII
  digits `0` through `9`, with numeric value greater than `0`, no sign, and no
  separators.
- A non-negative integer is an unsigned base-10 integer string containing only
  ASCII digits `0` through `9`, with numeric value greater than or equal to
  `0`, no sign, and no separators.
- A quoted path string is a double-quoted path value that escapes backslash,
  double quote, TAB, LF, and CR as `\\`, `\"`, `\t`, `\n`, and `\r`.
- Unless a more specific requirement says otherwise, ascending lexicographic
  order means ascending bytewise lexicographic order of the final serialized
  value being compared.
- Unless a more specific requirement says otherwise, continuing to later pages
  means continuing only to pages whose processing has not yet begun, whether
  those pages were already discovered or are discovered later in the same run.
- In literal option names and machine-readable field names such as
  `--encryption-key` and `default_encryption_key`, the word `key` denotes an
  encryption-recipient identity token and not secret key material.
- A valid install manifest is a UTF-8 text file with LF line endings, exactly
  one non-empty relative path per line, no duplicate lines, and no path that
  resolves outside the selected installation target.
- Unless a more specific requirement says otherwise, recording a scope finding
  for a condition means writing exactly one corresponding data row to
  `scope-findings.tsv`.
- Unless a more specific requirement says otherwise, classifying a condition as
  a page-local failure means writing exactly one corresponding data row to
  `failed-pages.tsv`.
- Unless a more specific requirement says otherwise, one underlying condition is
  reported in at most one of `failed-pages.tsv` or `scope-findings.tsv`; a
  page-local failure row and a scope-finding row are not both emitted for the
  same condition.
- If one page qualifies for multiple discovery paths, its single
  `discovery_source` classification uses this precedence order:
  `root`, then `tree`, then `linked`.
- Unless a more specific requirement says otherwise, report-content rules apply
  only when the corresponding report remains on disk as part of a plain output
  root or inside a successfully created encrypted archive.
- If no retained run result exists, requirements that mention `summary.txt` or
  other report files do not imply that duplicate standalone copies are created
  elsewhere; in that case the required outcome evidence is limited to the
  stdout lines, exit code, and sidecar artifacts explicitly required by this
  document.
- For report-set requirements, a retained run result means either a plain output
  root that remains on disk or a successfully created encrypted archive;
  standalone sidecar files are not report-set containers.
- Unless a more specific requirement says otherwise, `INCOMPLETE` denotes a
  top-level marker path named exactly `INCOMPLETE`; this document constrains its
  presence, absence, and location, but not its file type or file content.

## 4. Product Intent And Boundary


- `confluex` is an orchestration CLI over Confluence export tooling; it is not a
  replacement for Confluence itself.
- The product is responsible for predictable export planning and execution,
  including traversal, supported link discovery, output materialization, report
  generation, resumable export behavior, and optional encryption.
- The product is not responsible for creating, configuring, or repairing external
  Confluence access credentials.
- The product is not responsible for creating, importing, generating, or deleting
  GPG key material.
- The product shall not store or use encryption-recipient identities except as
  explicitly permitted by this document.
