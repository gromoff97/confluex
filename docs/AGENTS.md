# AGENTS

## Scope
Rules for reading and changing requirements in `docs/`.

## Read
- Read this file first.
- Then read only the relevant `FR-<AREA>.md` files for the task. For cross-area tasks, read each relevant area file.
- Area map: `CMD` command surface; `UX` operator experience; `VAL` invocation validation; `OPT` option semantics; `DIAG` diagnostics; `CONF` configuration; `LIFE` installation lifecycle; `RUN` run lifecycle; `SCOPE` scope discovery; `DATA` data acquisition; `OUT` outputs and artifacts; `REP` reports; `SAFE` safety; `INT` interruption and runtime failure; `RES` resume and recovery; `SEC` encryption; `OBS` observability and outcomes.
- Product behavior is defined only in `FR-<AREA>.md`.
- Do not infer requirements from non-requirement text.
- If two requirements overlap, the more specific requirement prevails.
- `Dependencies` list direct normative prerequisites and do not relax the dependent requirement.
- Exact backticked literals are normative when they define commands, options, files, headings, report headers, summary keys, closed token vocabularies, or complete machine-readable lines.
- Free-text explanatory fields such as `error_summary`, `detail`, and persistent log lines are not fixed verbatim unless a requirement explicitly fixes them.
- A rejected invocation exits non-zero before traversal, payload export, attachment download, report generation, output-root reuse, configuration mutation, installation writes, or uninstallation writes begin.
- A command begins command work when it first performs externally observable behavior other than rendering help or reporting a rejected invocation.
- `canonical page identifier`: unsigned base-10 page-id string with ASCII digits only, no sign, no separators, and no leading zeroes unless the value is exactly `0`.
- `positive integer`: unsigned base-10 integer string with ASCII digits only, numeric value greater than `0`, no sign, and no separators.
- `non-negative integer`: unsigned base-10 integer string with ASCII digits only, numeric value greater than or equal to `0`, no sign, and no separators.
- `quoted path string`: double-quoted path value that escapes backslash, double quote, TAB, LF, and CR as `\\`, `\"`, `\t`, `\n`, and `\r`.
- Unless a more specific requirement says otherwise, ascending lexicographic order means ascending bytewise lexicographic order of the final serialized value.
- In literals such as `--encryption-key` and `default_encryption_key`, `key` means an encryption-recipient identity token and not secret key material.
- `valid install manifest`: UTF-8 text with LF line endings, exactly one non-empty relative path per line, no duplicates, and no path that resolves outside the selected installation target.
- Unless a more specific requirement says otherwise, recording a scope finding writes exactly one corresponding data row to `scope-findings.tsv`.
- Unless a more specific requirement says otherwise, classifying a condition as a page-local failure writes exactly one corresponding data row to `failed-pages.tsv`.
- One underlying condition is reported in at most one of `failed-pages.tsv` or `scope-findings.tsv`.
- If one page qualifies for multiple discovery paths, `discovery_source` uses precedence `root`, then `tree`, then `linked`.
- A retained run result means either a plain output root that remains on disk or a successfully created encrypted archive; standalone sidecars are not report-set containers.
- Unless a more specific requirement says otherwise, report-content rules apply only when the corresponding report remains in a retained run result.
- If no retained run result exists, requirements that mention `summary.txt` or other report files do not imply standalone duplicate copies elsewhere.
- Unless a more specific requirement says otherwise, `INCOMPLETE` denotes a top-level marker path named exactly `INCOMPLETE`; requirements constrain its presence, absence, and location, but not its file type or file content.

## Requirement Quality
- Every new or materially changed requirement shall satisfy CIRCUS MATTA: Complete, Independent, Realisable, Consistent, Unambiguous, Specific to the product and operator context, Measurable, Acceptable, Testable, Traceable, Achievable.
- A requirement that fails CIRCUS MATTA shall be revised, split, narrowed, or rejected.

## Requirement Shape
- Use stable global IDs in the form `FR-<NNN>` with four digits, for example `FR-0001`.
- Allocate the next unused global ID. Do not renumber or reuse IDs.
- Each requirement shall express one independently meaningful obligation.
- Each requirement card shall use exactly:
  `### FR-<NNN>`
  `**Requirement**:`
  `**Applicability**:`
  `**Rationale**:`
  `**Acceptance Criteria**:`
  `**Dependencies**:`
  `**Traceability**:`

## Change
- Add, modify, or remove requirements only in the correct `FR-<AREA>.md`.
- Update acceptance criteria, dependencies, and traceability with any material requirement change.
- Do not duplicate requirements across files.
- Do not place product requirements in `AGENTS.md`.
