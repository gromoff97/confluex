# Confluex Functional Requirements

This document defines the functional requirements for `confluex` as a CLI export tool built to make Confluence export workflows safer, less repetitive, and easier to interpret than using raw `confluence-cli` commands directly.

These requirements are written from the product interface and the apparent user intent of the tool, not from its current internal implementation. They are intended to be detailed enough for future black-box testing and strong enough to guide refactoring or reimplementation.

## Product Intent and Boundary

- `confluex` is an orchestration layer over `confluence-cli`, not a replacement for Confluence itself.
- The tool exists to turn a root page into a predictable export run that handles child traversal, supported link discovery, payload persistence, reporting, and optional encryption as one coherent workflow.
- The tool is responsible for a safe and interpretable export workflow.
- The tool is not responsible for installing or configuring external Confluence access or for generating or importing GPG keys.
- Requirements in this document should preserve product behavior that matters to operators, testers, and future maintainers. They should not preserve accidental implementation detail for its own sake.

## Workflow and Command Model

### FR-CMD-001
**Requirement**: The product shall expose the public commands `export`, `plan`, `doctor`, `config`, `install`, and `uninstall`.

**Acceptance**:
1. Each command is invocable as a distinct top-level CLI workflow.
2. Help output identifies each command and its operator purpose.

**Traceability**:
- Area: public workflow surface
- Related: `FR-CMD-002`, `FR-DIAG-001`, `FR-RUN-001`

### FR-CMD-002
**Requirement**: The CLI shall reject invalid or unsafe invocations before any page-processing work starts.

**Acceptance**:
1. `export` and `plan` reject a missing root page id before any external page-processing call starts.
2. `--page-id` must be numeric; `--max-find-candidates` must be a positive integer; `--max-pages`, `--max-download-mib`, and `--sleep-ms` must be non-negative integers.
3. `--log-file` and `--encryption-key` require non-empty values when specified.
4. Command-specific options that do not belong to the selected workflow cause immediate rejection, including `--clear-encryption-key` outside `config` and `--install-dir` outside `install` or `uninstall`.
5. An explicit output directory is never silently reused.
6. Reusing an existing output directory is allowed only through an explicit supported recovery workflow rather than by default.

**Traceability**:
- Area: invocation safety
- Related: `FR-OUT-001`, `FR-SAFE-001`

### FR-CMD-003
**Requirement**: The public option set shall express operator intent rather than low-level implementation toggles.

**Acceptance**:
1. `--page-id` identifies the root page for `export` and `plan`, and optionally for access diagnosis in `doctor`.
2. `--out` controls the root result location.
3. `--safe`, `--max-pages`, `--max-download-mib`, `--sleep-ms`, and `--max-find-candidates` control run risk and traversal breadth.
4. `--critical` expresses fail-closed critical-use intent for `export` and `plan`.
5. `--confidential` expresses confidentiality-first intent for encrypted `export` and `plan`.
6. `--resume` expresses cross-run export recovery intent and is not merely a synonym for accepting an existing output directory.
7. `--no-fail-fast`, `--keep-metadata`, `--log-file`, and `--encryption-key` change run behavior or output materialization.
8. `--verify-encryption` expresses encryption-recipient preflight intent for `doctor`.

**Traceability**:
- Area: option semantics
- Related: `FR-RUN-001`, `FR-OUT-002`, `FR-SAFE-001`, `FR-SEC-001`

## Diagnostics, Configuration, and Lifecycle

### FR-DIAG-001
**Requirement**: `doctor` shall verify that the local environment is capable of running `confluex`, and shall optionally verify access to a root page.

**Acceptance**:
1. `doctor` checks required local command availability for the public product workflow, including the parser runtime and the external Confluence CLI dependency.
2. `doctor` without `--page-id` explicitly reports that page-access verification was skipped.
3. `doctor --page-id <id>` either confirms access and reports page identity information or explicitly reports access failure.
4. `doctor --verify-encryption` validates the effective encryption recipient when one is provided explicitly or saved by configuration.
5. If `doctor --verify-encryption` is requested with no explicit or saved encryption key identity available, the command reports that condition explicitly.
6. `doctor` does not claim to validate a saved encryption key identity unless encryption verification was requested explicitly.
7. `doctor` reports the current product support profile so operators do not have to infer it from code or tests.

**Traceability**:
- Area: diagnostics
- Related: `FR-RUN-001`

### FR-CONF-001
**Requirement**: `config` shall manage only the default encryption key identity used by `export` and `plan`.

**Acceptance**:
1. `config` can show the current saved encryption key identity state.
2. `config` can save a new default encryption key identity.
3. `config` can clear the saved default encryption key identity.
4. `config` does not claim to create, import, or validate GPG key material.

**Traceability**:
- Area: configuration
- Related: `FR-SEC-001`

### FR-LIFE-001
**Requirement**: `install` and `uninstall` shall provide a self-contained lifecycle for the CLI.

**Acceptance**:
1. `install` places the CLI in the selected installation target.
2. `install` also places the required support files needed for that installed CLI to run.
3. `uninstall` removes the self-installation from the selected location.
4. `uninstall` remains idempotent when nothing is installed there.

**Traceability**:
- Area: lifecycle
- Related: `FR-CMD-001`

## Run Model: Export and Plan

### FR-RUN-001
**Requirement**: `export` and `plan` shall share the same discovery scope and root-page preflight model.

**Acceptance**:
1. Both workflows require a root page id.
2. Both workflows validate root-page accessibility before traversal begins.
3. Both workflows discover pages from the same graph rules unless a requirement explicitly distinguishes them.

**Traceability**:
- Area: shared run model
- Related: `FR-GRAPH-001`, `FR-GRAPH-002`

### FR-RUN-002
**Requirement**: `export` shall be the content-materializing workflow.

**Acceptance**:
1. `export` persists exported page payloads.
2. `export` persists attachment payloads when attachments are present.
3. `export` produces the run-level report set.

**Traceability**:
- Area: export mode
- Related: `FR-OUT-002`, `FR-OUT-003`

### FR-RUN-003
**Requirement**: `plan` shall be the dry-run planning workflow for the same export scope.

**Acceptance**:
1. `plan` reads enough data to discover pages, resolve supported links, and describe the run result.
2. `plan` does not persist exported page HTML.
3. `plan` does not persist downloaded attachments.
4. `plan` still produces the run-level report set.

**Traceability**:
- Area: plan mode
- Related: `FR-DATA-001`, `FR-OUT-002`, `FR-OUT-004`

### FR-RUN-004
**Requirement**: `export` shall provide an explicit cross-run recovery workflow for continuing from a previous explicit output root.

**Acceptance**:
1. `--resume` is supported only for `export`, not for `plan`, `doctor`, `config`, `install`, or `uninstall`.
2. `--resume` requires an explicit `--out` that already exists as a directory from a prior run.
3. `--resume` rejects an explicit output root that has no recovery manifest or is otherwise not compatible with the supported recovery workflow.
4. In `--resume`, the product rebuilds run discovery and traversal from the root page again instead of blindly trusting prior reports as the final truth.
5. In `--resume`, previously materialized page payload may be reused for a page only when the prior output provides enough page-identity evidence for safe reuse.
6. In `--resume`, page payload that cannot be reused safely is materialized again rather than guessed.

**Traceability**:
- Area: recovery workflow
- Related: `FR-CMD-002`, `FR-CMD-003`, `FR-OUT-001`, `FR-OBS-001`

## Data Acquisition and Parsing Semantics

### FR-DATA-001
**Requirement**: The run shall gather page data from operator-relevant Confluence sources needed for export planning and execution.

**Acceptance**:
1. The run reads root-page and per-page metadata needed to identify page title, space, and access.
2. The run reads storage XML needed for link discovery.
3. The run reads recursive child-listing data needed to include the full root child tree in scope.
4. Title-based link resolution may read search results and candidate page identity data needed to resolve an internal link conservatively.
5. When candidate inspection or child-tree knowledge is only partial, the run records that condition as a scope finding instead of silently treating scope as fully trusted.
5. `export` additionally materializes page HTML and attachments.
6. `plan` may gather attachment-list preview data without downloading attachment payloads.

**Traceability**:
- Area: acquisition model
- Related: `FR-RUN-002`, `FR-RUN-003`, `FR-OUT-004`

### FR-GRAPH-001
**Requirement**: The export scope shall include the root page and the full recursive child tree of that root page.

**Acceptance**:
1. The root page is always part of run scope after successful preflight.
2. Child-tree traversal is recursive from the root page.
3. Failure to fully enumerate descendants does not invalidate the root page itself as part of the run.
4. If child-tree data indicates pagination or otherwise incomplete recursive knowledge, that condition is recorded as a scope finding.

**Traceability**:
- Area: tree traversal
- Related: `FR-GRAPH-002`

### FR-GRAPH-002
**Requirement**: The export scope shall also include linked pages discovered in page content through supported internal-link mechanisms.

**Acceptance**:
1. Supported internal links may add linked pages to run scope.
2. Linked pages are distinct from root-tree pages in run interpretation.
3. Descendants of a linked page are not automatically added solely because that linked page was discovered.
4. Links found while processing a linked page do not expand scope further; link-driven expansion is single-hop only from root-tree pages.

**Traceability**:
- Area: linked discovery
- Related: `FR-LINK-001`, `FR-LINK-004`

### FR-LINK-001
**Requirement**: The tool shall support product-level internal link discovery from the link forms exposed by the current `confluex` interface.

**Acceptance**:
1. Supported discovery sources include child-tree results.
2. Supported discovery sources include internal content-id references.
3. Supported discovery sources include page references by page identity or title.
4. Supported discovery sources include macro page parameters and internal links carrying a page identifier.
5. Supported discovery sources include `ri:url` references when they carry a resolvable internal page identifier or a resolvable internal page title/space path.
6. Supported discovery sources include internal `href` forms when they carry a resolvable page identifier or a resolvable internal page title/space path.

**Traceability**:
- Area: supported link forms
- Related: `FR-LINK-002`, `FR-LINK-003`

### FR-LINK-002
**Requirement**: Link resolution shall be conservative and shall prefer unresolved outcomes over guessed outcomes.

**Acceptance**:
1. An internal link is resolved only when the tool has enough information to do so confidently.
2. Ambiguous title-based candidates remain unresolved.
3. Candidate fan-out limits may prevent resolution and shall lead to unresolved outcome rather than guessing.

**Traceability**:
- Area: resolution conservatism
- Related: `FR-LINK-003`, `FR-REP-002`

### FR-LINK-003
**Requirement**: The tool shall ignore false-positive link-like content that should not expand export scope.

**Acceptance**:
1. External links that only resemble internal page links do not expand run scope.
2. Link-like text inside code-like or plain-text content does not expand run scope.
3. Non-page child results do not expand run scope as pages.

**Traceability**:
- Area: false-positive control
- Related: `FR-LINK-001`, `FR-LINK-002`

### FR-LINK-004
**Requirement**: The run shall remain stable under duplicate discovery and cycles.

**Acceptance**:
1. A page is processed at most once per run.
2. Multiple discovery paths to the same page do not cause duplicate processing.
3. Cyclic links and self-links do not create unbounded traversal.

**Traceability**:
- Area: traversal stability
- Related: `FR-GRAPH-001`, `FR-GRAPH-002`

### FR-LINK-005
**Requirement**: When the product encounters internal-reference patterns that are plausibly relevant to scope but outside the supported discovery profile, it shall surface that fact explicitly rather than silently treating the run as fully trusted.

**Acceptance**:
1. The product may keep a bounded support profile instead of claiming universal Confluence markup support.
2. Unsupported but internal-looking reference forms detected during parsing are recorded as machine-readable scope findings.
3. Scope findings degrade operator trust in semantic completeness even if the run remains otherwise successful.
4. Partially inspectable title-resolution outcomes are also recorded as scope findings when candidate visibility is incomplete.

**Traceability**:
- Area: support profile and unsupported reference handling
- Related: `FR-LINK-001`, `FR-REP-001`, `FR-OBS-001`

## Output and Artifact Model

### FR-OUT-001
**Requirement**: Each run shall have a predictable output root.

**Acceptance**:
1. If the operator does not specify `--out`, the product creates a unique output root for the run.
2. If the operator specifies `--out`, that location becomes the output root.
3. If an explicit output root already exists and `--resume` was not requested, the run is rejected before processing begins.
4. If `--resume` was requested, the explicit output root is accepted only when it is an existing directory compatible with the supported recovery workflow.

**Traceability**:
- Area: output root
- Related: `FR-CMD-002`, `FR-RUN-004`

### FR-OUT-002
**Requirement**: The output root shall separate run-level interpretation artifacts from per-page payload.

**Acceptance**:
1. The run-level report set is persisted at the run root.
2. Page payload is persisted under a dedicated `pages/` area rather than mixed into the report files.
3. The output layout remains readable enough for an operator or test to locate payload and reports by path without reading internal logs.

**Traceability**:
- Area: output layout
- Related: `FR-OUT-003`, `FR-REP-001`

### FR-OUT-003
**Requirement**: Each processed page shall have a dedicated payload location when page payload is persisted.

**Acceptance**:
1. Each processed page gets its own payload location under `pages/`.
2. When the page space is known, that payload location is grouped beneath a space-level folder before the page folder.
3. Exported page HTML is persisted within that page's own payload location.
4. Attachments for a page are persisted beneath that page's payload location.
5. Page naming in persisted payload remains unique and operator-readable.
6. The manifest `folder` value points to the persisted payload location for that page.
7. Page-folder path components are bounded so unusually long page titles or space keys do not create unbounded page-directory names.

**Traceability**:
- Area: page payload
- Related: `FR-RUN-002`

### FR-OUT-004
**Requirement**: Metadata persistence shall follow explicit product rules rather than happen accidentally.

**Acceptance**:
1. Without `--keep-metadata`, metadata artifacts are not persisted merely because they were needed internally for processing.
2. With `--keep-metadata`, each page payload persists `_info.txt` and `_storage.xml`.
3. With `--keep-metadata` in planning mode, persisted metadata also includes `_attachments_preview.txt` when attachment-preview data was gathered for that page.
4. `plan` may still use temporary metadata artifacts internally even when those artifacts are not persisted in final output.

**Traceability**:
- Area: metadata model
- Related: `FR-RUN-003`, `FR-DATA-001`

## Report and Result Semantics

### FR-REP-001
**Requirement**: Every successful or partially successful run shall produce a standard report set sufficient to interpret the run.

**Acceptance**:
1. The standard report set includes `manifest.tsv`, `resolved-links.tsv`, `unresolved-links.tsv`, `failed-pages.tsv`, `scope-findings.tsv`, and `summary.txt`.
2. The report set exists for successful runs and for partially successful runs that still yield interpretable results.
3. If the final result is converted into an encrypted artifact, the report set remains part of that result.

**Traceability**:
- Area: report set
- Related: `FR-REP-002`, `FR-SEC-001`

### FR-REP-002
**Requirement**: The report set shall distinguish the major semantic outcomes of a run.

**Acceptance**:
1. The manifest identifies which pages were processed and how they entered the run.
2. The resolved-link report identifies successful source-to-target link resolution outcomes.
3. The unresolved-link report identifies discovered links that remained unresolved.
4. The failed-pages report identifies page-local failures.
5. The scope-findings report identifies conditions that degrade trust in scope completeness or support-profile confidence, including unsupported references, partial graph knowledge, and partially inspectable title resolution.
6. The summary identifies run mode, main counts, limits, support-profile state, and completion state.

**Traceability**:
- Area: report semantics
- Related: `FR-LINK-002`, `FR-OBS-001`

### FR-REP-003
**Requirement**: Report file schemas shall remain stable enough for operator interpretation and automated black-box testing.

**Acceptance**:
1. `manifest.tsv` contains a header and one row per processed page, including page identity, page space, page title, persisted folder, discovery source, run mode, and attachment count.
2. `resolved-links.tsv` contains a header and one row per unique resolved source-to-target page dependency, including source page, source title, link kind, raw link value, and resolved target identity.
3. `unresolved-links.tsv` contains a header and one row per unresolved discovered link, including source page context, link kind, and raw link value.
4. `failed-pages.tsv` records the affected page and the failed page-local operation.
5. `scope-findings.tsv` contains a header and one row per scope-relevant finding, including page context, finding area, finding type, and detail.
6. `summary.txt` uses stable `key=value` style lines rather than prose-only output.
7. `summary.txt` includes machine-readable recovery fields that distinguish whether the run used recovery mode and how many page payloads were reused versus freshly materialized.

**Traceability**:
- Area: report schema
- Related: `FR-REP-001`, `FR-REP-002`, `FR-OBS-001`, `FR-RUN-004`

## Safety, Failure, and Interruption

### FR-SAFE-001
**Requirement**: The product shall provide a conservative safe profile for production-style usage.

**Acceptance**:
1. `--safe` applies conservative defaults for discovery breadth, page count, total download volume, and inter-page delay.
2. Explicit operator-specified values override safe-profile defaults.
3. `--safe` is a conservative profile rather than a guarantee of semantic completeness, dependency correctness, or confidentiality.

**Traceability**:
- Area: safe profile
- Related: `FR-SAFE-002`, `FR-SAFE-006`

### FR-SAFE-002
**Requirement**: The product shall provide explicit run-limiting controls.

**Acceptance**:
1. `--max-pages` limits processed page count.
2. `--max-download-mib` limits total downloaded volume.
3. `--sleep-ms` throttles page-to-page processing cadence.
4. `--max-find-candidates` limits title-based link candidate fan-out.
5. When a configured limit stops the run early, that state is visible in the result.

**Traceability**:
- Area: run limits
- Related: `FR-LINK-002`, `FR-OBS-001`

### FR-SAFE-003
**Requirement**: The product shall distinguish fail-fast behavior from best-effort behavior.

**Acceptance**:
1. In fail-fast behavior, a fatal runtime failure stops further processing.
2. In best-effort behavior requested by the operator, page-local failure does not stop the entire run.
3. Recorded failures remain visible in the report set in both modes.

**Traceability**:
- Area: failure mode selection
- Related: `FR-REP-002`, `FR-SAFE-004`

### FR-SAFE-004
**Requirement**: The product shall distinguish interrupted export from interrupted dry-run planning.

**Acceptance**:
1. An interrupted real export preserves already written result data.
2. An interrupted real export writes an `INCOMPLETE` marker and marks `summary.txt` as incomplete.
3. An interrupted dry-run removes the run output directory rather than leaving a misleading partial plan output as if it were complete.
4. The run outcome after interruption remains interpretable by an operator.

**Traceability**:
- Area: interruption semantics
- Related: `FR-OBS-001`, `FR-SEC-001`

### FR-SAFE-005
**Requirement**: Configured stop conditions and runtime failures shall yield interpretable partial outcomes rather than ambiguous results.

**Acceptance**:
1. Hitting `--max-pages` or `--max-download-mib` stops further processing and leaves an interpretable partial result.
2. A partial result caused by a configured stop condition is marked as incomplete in `summary.txt` and includes the stop reason.
3. A runtime failure after some artifacts were already written leaves those artifacts available for inspection unless a different requirement explicitly removes them.
4. Partial outcomes are distinguishable from clean success without requiring inspection of internal implementation.
5. A partial result that remains on disk after runtime failure is eligible to serve as input to the explicit recovery workflow when the operator chooses to rerun with `--resume`.

**Traceability**:
- Area: partial result semantics
- Related: `FR-SAFE-002`, `FR-SAFE-003`, `FR-OBS-001`

### FR-SAFE-006
**Requirement**: The product shall provide an explicit fail-closed critical-use mode for `export` and `plan`.

**Acceptance**:
1. `--critical` implies the conservative safe profile unless explicit operator-specified limits override those defaults.
2. `--critical` cannot be combined with best-effort behavior.
3. In `--critical` mode, a completed run with unresolved links or recorded page-local failures is not presented as an acceptable success outcome.
4. In `--critical` mode, a completed run with recorded scope findings is also not presented as an acceptable success outcome.
5. In `--critical` mode, the result remains interpretable for inspection, but the command exits non-zero and `summary.txt` records a blocking final status.

**Traceability**:
- Area: critical policy
- Related: `FR-SAFE-001`, `FR-SAFE-003`, `FR-OBS-001`

## Security and Observability

### FR-SEC-001
**Requirement**: When encryption is requested explicitly or through saved default configuration, the final result shall be materialized as an encrypted result artifact.

**Acceptance**:
1. Successful encrypted completion produces `<out>.tar.gz.gpg` as the encrypted archive of the run result.
2. Successful encrypted completion also produces `<out>.tar.gz.gpg.txt` with operator instructions for decrypting and extracting the result.
3. After successful encryption, the plain output directory is removed.
4. An explicit encryption key identity overrides a saved default encryption key identity for that run.
5. If no explicit encryption key identity is provided, a saved default encryption key identity is used automatically when present.
6. If encryption fails, the plain result remains available and the failed encryption path is not presented as a successful encrypted completion.
7. `--confidential` is available as a confidentiality-first mode for encrypted runs and implies critical-use behavior.
8. In `--confidential` mode, an effective encryption key identity is required before the run proceeds.
9. In `--confidential` mode, encryption failure does not leave plain run payload artifacts on disk as a recovery result.

**Traceability**:
- Area: encrypted results
- Related: `FR-CONF-001`, `FR-REP-001`

### FR-OBS-001
**Requirement**: The product shall leave enough observability for an operator to interpret the run without inspecting internal implementation.

**Acceptance**:
1. `summary.txt` reports the command, root page, run mode, completion state, output location, path provenance, support profile, scope trust state, and encryption state.
2. `summary.txt` reports relevant configured limits and the processed-page breakdown across root, tree, linked, and other pages.
3. `summary.txt` reports manifest, resolved-link, unresolved-link, scope-finding, and failed-operation counts.
4. `summary.txt` reports downloaded total, content, and metadata volume.
5. `summary.txt` reports a machine-readable final status that distinguishes at least clean success, success with findings, policy failure, incomplete outcome, interruption, and encryption failure when those states are applicable.
6. `summary.txt` reports the blocking or warning reasons that explain why the final status is not clean success when such reasons exist.
7. `summary.txt` reports the reason for early or incomplete termination when applicable.
8. If persistent logging is requested, the run leaves a separate persistent log artifact.
9. When recovery mode is used, `summary.txt` reports that fact and the reused-versus-fresh payload counts so an operator can tell whether the rerun actually avoided redundant page downloads.

**Traceability**:
- Area: observability
- Related: `FR-REP-002`, `FR-SAFE-002`, `FR-SAFE-004`

## Traceability Model

| Requirement Group | Product Area | Future Test Focus |
|---|---|---|
| `FR-CMD-*` | command surface and operator controls | CLI contract and validation tests |
| `FR-DIAG-*`, `FR-CONF-*`, `FR-LIFE-*` | diagnostics, config, lifecycle | operator workflow tests |
| `FR-RUN-*`, `FR-DATA-*`, `FR-GRAPH-*`, `FR-LINK-*` | run semantics and page-discovery model | traversal and parsing tests |
| `FR-OUT-*`, `FR-REP-*` | output and reporting | artifact-structure and report tests |
| `FR-SAFE-*`, `FR-SEC-*`, `FR-OBS-*` | safety, interruption, encryption, observability | failure-mode and result-interpretation tests |

## Glossary

- **root page**: the page chosen by the operator as the starting point of the run.
- **child tree**: the recursive descendant tree of the root page.
- **linked page**: a page added to run scope through supported internal-link discovery.
- **output root**: the top-level result location for one run.
- **page payload**: persisted content and attachments associated with a processed page.
- **report set**: the run-level files used to interpret the run result.
- **unresolved link**: a discovered link that the product did not resolve into a target page.
- **encryption key identity**: the value used as the encryption recipient for a run result.
