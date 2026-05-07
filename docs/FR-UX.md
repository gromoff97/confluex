# Operator Experience Requirements


### FR-0007
**Requirement**: Top-level help shall support immediate command discovery.

**Applicability**:
- `confluex --help`
- `confluex` with no command and no help flag

**Rationale**:
- Operators need to discover available workflows and their purposes without
  trying commands blindly.

**Acceptance Criteria**:
1. `confluex --help` writes help output to `stdout`; this top-level help shape
   has exactly one argv token after the program path, `--help`.
2. Top-level help contains exactly the headings `Usage` and `Commands` in that
   order and no other section headings.
3. The `Usage` section contains exactly one non-empty line:
   `  confluex <command> [options]`.
4. Under `Commands`, supported top-level commands appear exactly once each in
   the public command order governed by `FR-0222`: `export`, `plan`, `doctor`.
5. Under `Commands`, each supported top-level command has exactly one purpose
   statement that fits on one line and identifies that command's canonical
   workflow.
6. Each command entry line under `Commands` is exactly two ASCII spaces, then
   the command token from criterion 4, then exactly two ASCII spaces, then the
   exact purpose statement from criterion 7.
7. The exact command purpose statements are: `export` ->
   `materialized Markdown export workflow`; `plan` ->
   `dry-run planning workflow`; and `doctor` -> `diagnostic workflow`.
8. The `Commands` section contains no non-empty lines other than the command
   entry lines from criteria 4 and 6.
9. Top-level help contains no non-empty lines outside the `Usage` and `Commands`
   sections.
10. Top-level help contains no empty lines.
11. Top-level help is UTF-8 text with LF line endings.
12. The final physical line of top-level help is terminated by LF, and no bytes
   occur after that LF.
13. `confluex` with no command and no help flag writes the same top-level help
    output to `stdout` as `confluex --help`, writes nothing to `stderr`,
    performs no command work other than rendering help, and exits `0`.
14. `confluex --help` exits `0` and writes nothing to `stderr`.
15. A `--help` token participates in top-level help only in the exact argv shape
    from criterion 1; any other argv shape is governed by command selection and
    invocation validation rather than this card.

**Dependencies**:
- `FR-0001`
- `FR-0002`
- `FR-0003`
- `FR-0222`
- `FR-0242`
- `FR-0118`

**Traceability**:
- Area: operator experience
- Observable evidence: top-level help output, stdout, exit code

### FR-0008
**Requirement**: Command help shall distinguish required and optional usage
correctly.

**Applicability**:
- `confluex <command> --help`

**Rationale**:
- Operators need command help with stable sections, correct required-versus-
  optional option grouping, and explicit notes for the governed option
  relationships that this card owns.

**Acceptance Criteria**:
1. Command help writes to `stdout`; this command-help shape has exactly two argv
   tokens after the program path: one supported command token followed by
   `--help`.
2. Command help contains the sections `Usage`, `Purpose`, `Required options`,
   `Optional options`, and `Examples` in that order.
3. A trailing `Notes` section is present only when the command has at least one
   mutually exclusive option relationship or dependent option relationship among
   its supported options; otherwise the `Notes` section is absent. When
   present, it contains only note lines governed by criterion 18.
4. For criterion 3, a mutually exclusive option relationship is any rejected
   option combination in `FR-0015` that involves the target command.
5. For criterion 3, a dependent option relationship is an accepted option whose
   use requires another accepted option under `FR-0026` or `FR-0230`.
6. If a command has no required options, the `Required options` section states
   exactly one line `  none`.
7. If a command has no optional options, the `Optional options` section states
   exactly one line `  none`.
8. Required options are exactly the supported options whose omission causes
   every otherwise valid non-help invocation of the target command to be rejected
   under `FR-0013`; all other supported options are optional options.
9. Each supported option of the target command appears exactly once under either
   `Required options` or `Optional options`, according to criterion 8.
10. Within `Required options` and `Optional options`, entries appear in the same
   relative order as that command's supported option list in `FR-0036`,
   restricted to the options assigned to that section.
11. Each section heading is exactly the heading text from criterion 2 or the
   optional heading `Notes`, on its own line with no trailing colon.
12. Each option entry line begins with two ASCII spaces, then the option token;
   when that option takes a value, the option token is followed by exactly one
   ASCII space and then the exact value placeholder defined by `FR-0036`; after
   the option token or value placeholder, the line contains at least two ASCII
   spaces and then one non-empty single-line description.
13. The `Usage` section contains exactly one non-empty line selected by target
   command: `  confluex export --page-id <id> [options]`,
   `  confluex plan --page-id <id> [options]`, or
   `  confluex doctor [options]`.
14. The `Purpose` section contains exactly one non-empty line. When another
   applicable help requirement for the target command explicitly refines the
   `Purpose` line content, that more specific requirement governs the content of
   that same single line. Otherwise the line is exactly two ASCII spaces
   followed by the target command's exact canonical workflow label from
   `FR-0007` criterion 7.
15. `Required options` and `Optional options` contain no non-empty lines other
   than either the shared absence-token line from criteria 6 or 7, or option
   entry lines from criteria 8 through 12.
16. The `Examples` section contains one or more non-empty lines. When another
   applicable help requirement for the target command explicitly refines the
   `Examples` section, that more specific requirement governs its content.
   Otherwise the section contains exactly one non-empty line selected by target
   command: `  confluex export --page-id <id>`,
   `  confluex plan --page-id <id>`, or `  confluex doctor`.
17. The `Examples` section contains no other non-empty lines beyond the example
   lines required by criterion 16 and any more specific applicable help
   requirement for the target command.
18. If `Notes` is present, every non-empty `Notes` line begins with two ASCII
   spaces; each relationship from criteria 4 and 5 contributes exactly one note
   line and no other note lines are present; for a mutually exclusive
   relationship, the note line is exactly
   `  <earlier_option> mutually exclusive with <later_option>`, where
   `<earlier_option>` and `<later_option>` are the affected option tokens in the
   same relative order they appear in the target command's supported-option list
   under `FR-0036`; for a dependent option relationship, the note line is
   exactly `  <dependent_option> requires <required_option>`, where
   `<dependent_option>` is the accepted option from criterion 5 and
   `<required_option>` is the option it requires; and when `Notes` contains more
   than one note line, those lines appear in ascending lexicographic order of
   the tuple of supported-option-list positions of the involved option tokens
   under `FR-0036` after sorting each relationship's positions ascending, with
   exact ties broken by `mutually exclusive` before `requires`.
19. Command help contains no empty lines.
20. Command help is UTF-8 text with LF line endings.
21. Command help contains no non-empty lines outside the governed sections from
   criteria 2 and 3.
22. Command help contains no section headings other than the exact headings
   permitted by criteria 2 and 3.
23. Physical lines appear in the order required by criteria 2 and 3: a section
   heading line is followed immediately by that section's governed content lines
   until the next section heading or the end of output.
24. The final physical line of command help is terminated by LF, and no bytes
   occur after that LF.
25. The placeholder `<id>` in the governed example-line forms from criterion 16
   denotes one conforming page-id value under `FR-0014`.
26. Each governed example line in the `Examples` section is accepted under this
   document when its placeholders are replaced with conforming values.
27. Command help exits `0`, writes nothing to `stderr`, and performs no command
   work other than rendering help.
28. A `--help` token participates in command help only in the exact argv shape
    from criterion 1; in any other position, it is interpreted by command
    selection and invocation validation as an ordinary raw argv token.

**Dependencies**:
- `FR-0007`
- `FR-0001`
- `FR-0002`
- `FR-0003`
- `FR-0222`
- `FR-0223`
- `FR-0224`
- `FR-0014`
- `FR-0242`
- `FR-0013`
- `FR-0015`
- `FR-0026`
- `FR-0230`
- `FR-0036`
- `FR-0118`

**Traceability**:
- Area: operator experience
- Observable evidence: command help output on stdout

### FR-0009
**Requirement**: Validation and warning messages shall identify the option or
condition that requires correction.

**Applicability**:
- rejected invocations
- warnings emitted during accepted `export`, `plan`, or `doctor` invocations

**Rationale**:
- Operators need to know what to correct without inspecting code or logs.

**Acceptance Criteria**:
1. The first stderr line for a rejected invocation uses the validation diagnostic
   selection and serialization rules defined by `FR-0146`.
2. If the unbounded-run warning is emitted, it is written to `stderr` and its
   required warning line is exactly
   `WARNING: unbounded_run use --max-pages or --max-download-mib`;
   the condition that emits that warning is governed by `FR-0094`.
3. The unbounded-run warning contains no required stderr lines other than the
   line from criterion 2; additional stderr lines, if any, are non-governed
   diagnostic text and are emitted only after all required warning lines
   applicable to the invocation.
4. Additional stderr lines, if any, are non-governed diagnostic text and are
   emitted only after the required warning line from criterion 2.

**Dependencies**:
- `FR-0146`
- `FR-0094`

**Traceability**:
- Area: operator experience
- Observable evidence: stderr warning and error output

### FR-0010
**Requirement**: Operator-visible stream usage shall separate information from
warnings and errors.

**Applicability**:
- all accepted and rejected invocations

**Rationale**:
- Operators and automation need consistent stream routing.

**Acceptance Criteria**:
1. Informational output for accepted commands is written to `stdout`.
2. Required warnings are written to `stderr`.
3. Rejected-invocation errors are written to `stderr`.

**Dependencies**:
- None

**Traceability**:
- Area: operator experience
- Observable evidence: stdout and stderr stream selection

### FR-0123
**Requirement**: `export --help` shall document Markdown-only materialized page
export explicitly.

**Applicability**:
- `confluex export --help`

**Rationale**:
- Operators need command help that makes Markdown-only export discoverable
  without suggesting removed HTML compatibility.

**Acceptance Criteria**:
1. The `Purpose` section identifies `export` as a Markdown export workflow.
2. The `Examples` section contains exactly one accepted `export` example line.
3. The `Optional options` section contains a `--zip` entry whose description
   names ZIP archive creation without changing the Markdown payload format.

**Dependencies**:
- `FR-0001`
- `FR-0008`
- `FR-0036`
- `FR-0121`
- `FR-0220`

**Traceability**:
- Area: operator experience
- Observable evidence: `confluex export --help` option text and examples

### FR-0243
**Requirement**: `doctor --help` shall document token-only env/env-file
diagnostics.

**Applicability**:
- `confluex doctor --help`

**Rationale**:
- Operators need diagnostic help that points them to the public configuration
  inputs used by `doctor`.

**Acceptance Criteria**:
1. The `Usage` section shows exactly `  confluex doctor [options]` as the
   accepted command shape, using the usage-line serialization defined by
   `FR-0008`.
2. The `Optional options` section lists exactly `--page-id <id>`,
   `--env-file <file>`, and `--log-file <file>` in the relative order governed
   by `FR-0036`.
3. The `Purpose` section identifies `doctor` as a diagnostic workflow for local
   prerequisites, token-only Confluence configuration, optional page access,
   and supported link forms.
4. The `Examples` section contains exactly one accepted `doctor` example line.

**Dependencies**:
- `FR-0008`
- `FR-0036`
- `FR-0043`
- `FR-0219`

**Traceability**:
- Area: operator experience
- Observable evidence: `confluex doctor --help` output
