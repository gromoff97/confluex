# Run Lifecycle Requirements


### FR-0052
**Requirement**: `export` and `plan` shall share one scope-discovery model.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators need planning and materialized export to reason about the same page
  scope.

**Acceptance Criteria**:
1. Both workflows require a root page id.
2. Both workflows validate root-page accessibility before traversal begins.
3. Both workflows apply the same scope-discovery requirements in `FR-0059`,
   `FR-0060`, `FR-0061`, `FR-0062`, `FR-0063`, `FR-0064`, `FR-0065`,
   `FR-0066`, `FR-0067`, and `FR-0141` to the same root page.

**Dependencies**:
- `FR-0017`
- `FR-0059`
- `FR-0060`
- `FR-0061`
- `FR-0062`
- `FR-0063`
- `FR-0064`
- `FR-0065`
- `FR-0066`
- `FR-0067`
- `FR-0141`

**Traceability**:
- Area: run lifecycle
- Observable evidence: accepted run behavior, scope reports

### FR-0053
**Requirement**: `export` shall materialize page content and attachment payloads.

**Applicability**:
- accepted `export` runs

**Rationale**:
- Operators need a workflow that produces materialized page and attachment
  payloads.

**Acceptance Criteria**:
1. `export` performs page-payload materialization under `FR-0074` for each page
   whose processing reaches that page's payload-materialization work, using the
   effective format selected under `FR-0121`.
2. When page-payload materialization succeeds for a page under `FR-0074`,
   `export` retains the selected page representation in that page's payload
   folder.
3. `export` performs attachment-download work under `FR-0075` for each page
   that reaches processed-page status under `FR-0127` and whose attachment
   data is available for download.
4. When attachment-download work succeeds for a page from criterion 3 under
   `FR-0075`, `export` retains that page's attachment payload files.
5. `export` produces the run-level report set.

**Dependencies**:
- `FR-0074`
- `FR-0075`
- `FR-0085`
- `FR-0086`
- `FR-0127`
- `FR-0121`

**Traceability**:
- Area: run lifecycle
- Observable evidence: page payload folders, attachments, report set

### FR-0054
**Requirement**: `plan` shall remain a dry-run planning workflow.

**Applicability**:
- accepted `plan` runs

**Rationale**:
- Operators need planning output without the cost and risk of payload
  materialization.

**Acceptance Criteria**:
1. `plan` acquires only the page-scope, link-discovery, page-metadata,
   storage-content, child-listing, title-resolution-candidate, and
   attachment-preview data needed to satisfy `FR-0059`, `FR-0060`, `FR-0061`,
   `FR-0062`, `FR-0063`, `FR-0064`, `FR-0065`, `FR-0066`, `FR-0067`,
   `FR-0141`, `FR-0069`, `FR-0070`, `FR-0071`, `FR-0072`, `FR-0073`,
   `FR-0092`, and `FR-0093`.
2. `plan` does not materialize page payload content or downloaded attachment
   payload files in the final retained result.
3. `plan` attachment-preview acquisition and the prohibition on downloaded
   attachment payload files are governed by `FR-0073`.
4. `plan` page-folder retention and the absence of `page.md`, `page.html`, and
   downloaded attachment payload files in retained plan page folders are
   governed by `FR-0081`.
5. `plan` produces the run-level report set.

**Dependencies**:
- `FR-0059`
- `FR-0060`
- `FR-0061`
- `FR-0062`
- `FR-0063`
- `FR-0064`
- `FR-0065`
- `FR-0066`
- `FR-0067`
- `FR-0141`
- `FR-0069`
- `FR-0070`
- `FR-0071`
- `FR-0072`
- `FR-0073`
- `FR-0081`
- `FR-0085`
- `FR-0092`
- `FR-0093`

**Traceability**:
- Area: run lifecycle
- Observable evidence: report set without materialized content payload

### FR-0055
**Requirement**: Automatically generated output-root names shall identify the
workflow and root page.

**Applicability**:
- `export` without `--out`
- `plan` without `--out`

**Rationale**:
- Operators need generated output roots that are readable and collision-safe.

**Acceptance Criteria**:
1. `export` without `--out` generates the base directory name
   `confluence_dump_<page_id>_<YYYYMMDDTHHMMSSZ>`.
2. `plan` without `--out` generates the base directory name
   `confluence_plan_<page_id>_<YYYYMMDDTHHMMSSZ>`.
3. `<page_id>` is the canonical resolved root page identifier.
4. The timestamp is the UTC time captured exactly once immediately after
   root-page preflight succeeds and before the product evaluates the first
   generated output-root candidate under criteria 6 through 8.
5. `<YYYYMMDDTHHMMSSZ>` serializes the UTC timestamp as four-digit year,
   two-digit month, two-digit day, literal `T`, two-digit 24-hour hour,
   two-digit minute, two-digit second, and literal `Z`, with all numeric
   components zero-padded.
6. For each base or suffixed generated directory name, before invocation
   acceptance the product obtains the process current working directory under
   `FR-0158`, requires that directory to be absolute and path-normalizable for
   the current platform under `FR-0159`, joins that single directory name to
   that directory, and path-normalizes the joined result under `FR-0159`.
7. Candidate existence is evaluated using non-following filesystem metadata, and
   any existing filesystem object at a candidate path counts as an existing
   candidate.
8. If metadata evaluation under criterion 7 fails for the generated base
   candidate path or for any suffixed candidate path checked before selection,
   the invocation is rejected under `FR-0019` before invocation acceptance.
9. If the generated base directory name already exists under criterion 7, or if
   any earlier suffixed candidate also exists under criterion 7, the product
   appends the smallest suffix `_<n>` whose `n` is a canonical positive integer
   governed by `FR-0014` and whose first retry uses `n=1`, then
   selects the smallest such candidate path that does not exist under
   criterion 7.
10. A generated output root is created as a direct child of the process current
   working directory.
11. If criterion 6 cannot obtain or validate the process current working
    directory, or if the joined candidate path cannot be path-normalized under
    `FR-0159`, the invocation is rejected under `FR-0019` before invocation
    acceptance.

**Dependencies**:
- `FR-0014`
- `FR-0021`
- `FR-0019`
- `FR-0017`
- `FR-0115`
- `FR-0154`
- `FR-0158`
- `FR-0159`

**Traceability**:
- Area: run lifecycle
- Observable evidence: generated output-root name and location

### FR-0056
**Requirement**: Accepted export-related runs shall emit a deterministic
`RUN_START` line.

**Applicability**:
- accepted non-help `export` and `plan` runs

**Rationale**:
- Operators need one machine-readable start signal with run identity.

**Acceptance Criteria**:
1. The run emits exactly one stdout line in the format
   `RUN_START command=<command> page_id=<page_id> output_root=<quoted_path_string>`
   unless the run enters the `FR-0147` signal-interruption branch before
   `RUN_START` emission or the pre-output-root runtime-failure branch governed
   by `FR-0102` before `RUN_START` emission.
2. `<command>` is `export` or `plan`.
3. `<page_id>` is the canonical resolved root page identifier.
4. `<quoted_path_string>` is the absolute logical plain output-root path for the
   run, serialized with the quoted path-string rules defined by `FR-0124`
   whose decoded value is that exact absolute path; whenever the run later
   retains a report set, `summary.txt` reports the same path as `output_root`.
5. `RUN_START` is emitted only after root-page preflight succeeds and the
   logical plain output-root path has been determined.
6. For an accepted non-help `export` or `plan` run, stdout contains only the
   export-related run lifecycle lines governed by `FR-0056`, `FR-0057`, and
   `FR-0058`.
7. If `RUN_START` is emitted, it is the first stdout line.
8. After `RUN_START`, zero or more `RUN_PHASE` lines appear in the lifecycle
   order governed by `FR-0057`.
9. If the run emits a `RUN_COMPLETE` line under `FR-0058`, that line is the final
   stdout line.
10. The governed stdout lifecycle output from criteria 1 through 9 is UTF-8
    text. When one or more lifecycle lines are emitted, each emitted line is
    one LF-terminated physical line and no byte other than the bytes of those
    emitted lines and their terminating LFs occurs on stdout.
11. If stdout is non-empty under criterion 10, its final byte is the LF that
    terminates the last emitted lifecycle line.

**Dependencies**:
- `FR-0017`
- `FR-0076`
- `FR-0085`
- `FR-0090`
- `FR-0124`
- `FR-0119`
- `FR-0057`
- `FR-0058`
- `FR-0147`
- `FR-0102`

**Traceability**:
- Area: run lifecycle
- Observable evidence: `RUN_START` line on stdout

### FR-0057
**Requirement**: Accepted export-related runs shall emit deterministic
`RUN_PHASE` lines.

**Applicability**:
- accepted non-help `export` and `plan` runs

**Rationale**:
- Operators need coarse-grained phase visibility during long-running runs.

**Acceptance Criteria**:
1. For this card, the governed phase tokens are exactly `scope_discovery`,
   `page_processing`, `report_generation`, and `encryption`.
2. `scope_discovery` means accepted run work after root-page preflight succeeds
   under `FR-0017`, after output-root creation or reuse has completed under
   `FR-0076`, and before the run begins page-processing work that can make a
   page reach processed-page status under `FR-0127`; this includes only the
   shared scope-discovery work governed by `FR-0052` that occurs before
   page-processing begins.
3. `page_processing` means accepted run work that can make one or more pages
   reach processed-page status under `FR-0127`, including any child-result or
   link discovery appended during page processing under `FR-0141`, before
   normal report generation or report synthesis begins.
4. `report_generation` means accepted run work that writes, rewrites, or
   synthesizes the closed report-file set governed by `FR-0085`, including
   report synthesis under `FR-0145`, before the encryption phase begins or
   final-outcome determination completes for an unencrypted run.
5. If the run enters one of the phase tokens from criteria 1 through 4 and the
   run does not take the pre-output-root signal-interruption branch governed by
   `FR-0147`, it emits exactly one stdout line `RUN_PHASE phase=<phase>` for
   that phase.
6. `RUN_PHASE phase=encryption` is emitted only if encryption is requested and
   the encryption phase actually begins.
7. Lifecycle order is exactly `scope_discovery`, `page_processing`,
   `report_generation`, then `encryption`.
8. Emitted `RUN_PHASE` lines appear in lifecycle order and each phase line
   appears at most once.

**Dependencies**:
- `FR-0017`
- `FR-0052`
- `FR-0076`
- `FR-0085`
- `FR-0112`
- `FR-0127`
- `FR-0141`
- `FR-0145`
- `FR-0147`

**Traceability**:
- Area: run lifecycle
- Observable evidence: `RUN_PHASE` lines on stdout

### FR-0058
**Requirement**: Accepted export-related runs that reach final-outcome
determination shall emit a deterministic `RUN_COMPLETE` line.

**Applicability**:
- accepted non-help `export` and `plan` runs except those terminated solely by
  signal interruption before the run determines `final_status`,
  `interrupt_reason`, and which retained artifact class, if any, remains on
  disk, and except accepted-run runtime failures or encrypted-finalization
  failures that never complete final-outcome determination

**Rationale**:
- Operators need one machine-readable completion signal with the final status and
  final artifact location.

**Acceptance Criteria**:
1. The run emits exactly one stdout line in the format
   `RUN_COMPLETE final_status=<status> artifact=<artifact_value>`.
2. `<status>` uses the exact `final_status` vocabulary defined by `FR-0113`.
3. If one or more retained run artifacts remain on disk, `<artifact_value>`
   selects exactly one authoritative artifact by this precedence order:
   retained encrypted archive path, then retained status-sidecar path, then
   retained plain output-root path.
4. When `<artifact_value>` names a retained path, it is serialized using the
   quoted path string governed by `FR-0124`, which for this line is one JSON
   string literal with no surrounding whitespace whose decoded value is that
   exact retained path.
5. If no retained run artifact remains on disk, including interrupted or
   runtime-failed `plan` branches that remove their plain output root before
   exit, `<artifact_value>` uses the shared absence token governed by
   `FR-0125`, serialized here as exactly the bare lowercase ASCII text `none`.
6. This card governs only the `RUN_COMPLETE` line shape, authoritative artifact
   selection, and emission timing; the `final_status` value contract used
   inside the line is governed exclusively by `FR-0113`.
7. `RUN_COMPLETE` is emitted after the final status and final artifact location
   have been determined and before process exit.

**Dependencies**:
- `FR-0113`
- `FR-0084`
- `FR-0076`
- `FR-0077`
- `FR-0078`
- `FR-0124`
- `FR-0125`
- `FR-0107`
- `FR-0110`

**Traceability**:
- Area: run lifecycle
- Observable evidence: `RUN_COMPLETE` line on stdout

### FR-0127
**Requirement**: Processed-page status shall use one deterministic lifecycle
threshold.

**Applicability**:
- accepted `export` and `plan` runs

**Rationale**:
- Operators and automation need `processed page` counts, manifest rows, and
  page-local failure reporting to refer to the same lifecycle state.

**Acceptance Criteria**:
1. A page becomes a processed page only when the run has the page metadata
   required to populate that page's `page_id`, `space_key`, `page_title`,
   `discovery_source`, and `run_mode` `manifest.tsv` fields under `FR-0086`.
   `folder` and `attachment_count` are not part of the processed-page threshold
   and may still serialize as `none` under `FR-0086` until later per-page
   artifact retention and attachment work determine them.
2. A page that never reaches processed-page status does not contribute a
   `manifest.tsv` row and does not contribute to `processed_pages`,
   `root_pages`, `tree_pages`, or `linked_pages`.
3. A page-local failure is still recorded in `failed-pages.tsv` even when the
   failing page never reaches processed-page status; in that case the
   unavailable identity fields use the shared absence token defined by
   `FR-0125` as required by `FR-0069` and `FR-0088`.
4. Once a page reaches processed-page status, later page-local failures,
   omitted payload files, or omitted attachment payload files do not remove that
   page from `manifest.tsv` or from the processed-page counts derived from
   `manifest.tsv`.

**Dependencies**:
- `FR-0069`
- `FR-0086`
- `FR-0088`
- `FR-0092`
- `FR-0125`

**Traceability**:
- Area: run lifecycle
- Observable evidence: manifest rows, processed-page counts, failed-pages rows

### FR-0132
**Requirement**: Non-help `selftest` invocations shall validate one
operator-supplied, already-running Confluence 7.13.7 target before attempted
fixture and live-regression phases.

**Applicability**:
- non-help `confluex selftest` invocations

**Rationale**:
- Maintainers need regression results that come from a known clean Confluence
  7.13.7 stand selected explicitly by the current invocation.

**Acceptance Criteria**:
1. The target base URL, username, and password are exactly the effective
   `--url`, `--login`, and `--password` values accepted under `FR-0131`.
2. `selftest` does not read environment variables, saved configuration, Docker
   labels, Docker container names, or hardcoded defaults to derive the target
   base URL, username, password, or stand identity.
3. Before fixture preparation begins, `selftest` performs exactly one HTTP Basic
   authenticated `GET` request to the governed Confluence request target
   `/rest/api/space?limit=1` using the target values from criterion 1.
4. The effective request URL for criterion 3 is formed from the target base URL
   and request target using the base-URL path-prefix rules from `FR-0216`.
5. The bootstrap phase succeeds only when the criterion-3 request completes with
   HTTP status `200`, the response body is UTF-8 JSON text, the JSON value is an
   object, the object contains array field `results`, and `results` is empty.
6. If the criterion-3 request cannot be created, cannot be completed, returns
   any HTTP status other than `200`, returns non-UTF-8 bytes, returns invalid
   JSON, returns a non-object JSON value, omits array field `results`, or returns
   one or more `results` entries, the bootstrap phase fails.
7. If the bootstrap phase fails, fixture application, expected-data preparation,
   and live regression execution are not attempted.
8. Bootstrap performs no Confluence mutation and does not create, start, stop,
   inspect, list, or remove any Docker container, Docker volume, or Docker
   network.

**Dependencies**:
- `FR-0019`
- `FR-0129`
- `FR-0131`
- `FR-0216`

**Traceability**:
- Area: run lifecycle
- Observable evidence: self-test report summary, target preflight behavior

### FR-0137
**Requirement**: Accepted `selftest` runs shall attempt fixture dataset
preparation when the bootstrap phase from `FR-0132` reaches
`bootstrap_status=passed`, before expected-data preparation under `FR-0144` or
live regression execution under `FR-0138`.

**Applicability**:
- accepted non-help `confluex selftest` invocations

**Rationale**:
- Maintainers need all live regression assertions to use one known read-only
  Confluence dataset.

**Acceptance Criteria**:
1. If the bootstrap phase from `FR-0132` reaches `bootstrap_status=passed`
   under `FR-0136`, `selftest` attempts fixture dataset preparation before
   expected-data preparation under `FR-0144` or live regression execution under
   `FR-0138` is attempted.
2. That attempted fixture dataset preparation is governed by `FR-0175`, and the
   resulting canonical fixture dataset contract is governed by `FR-0176`.
3. If the bootstrap phase from `FR-0132` reaches `bootstrap_status=failed`
   under `FR-0136`, fixture dataset preparation is not attempted.

**Dependencies**:
- `FR-0132`
- `FR-0136`
- `FR-0138`
- `FR-0144`
- `FR-0175`
- `FR-0176`

**Traceability**:
- Area: run lifecycle
- Observable evidence: fixture identity file and expected-data artifacts

### FR-0138
**Requirement**: Accepted `selftest` runs shall execute the governed live
regression entrypoint exactly once against the prepared explicit Confluence
target only when the bootstrap, fixture-application, and
expected-data-preparation phases have each reached `passed`.

**Applicability**:
- accepted non-help `confluex selftest` invocations

**Rationale**:
- Maintainers need one deterministic live-regression pass whose governed case
  checks are tied to the prepared explicit target.

**Acceptance Criteria**:
1. Before `bootstrap_status` is determined, `selftest` takes the runtime-root
   source string defined by `FR-0152`, path-normalizes that
   absolute source string under `FR-0159`, and uses the resulting absolute path
   as the self-test suite root for the current invocation.
2. Before `bootstrap_status` is determined and before any target access,
   fixture, expected-data, or live regression work begins, `selftest` evaluates with
   non-following filesystem metadata these suite-root-relative support paths:
   `tests/live-bats`,
   `tests/live-bats/live-regression.bats`,
   `fixtures/confluence-7137/content/manifest.json`,
   `fixtures/confluence-7137/expected/live-commands.json`,
   `fixtures/confluence-7137/expected/live-command-expectations.json`, and
   `fixtures/confluence-7137/comparison-rules.json`, together with every
   suite-root-relative source payload file required by `FR-0179`.
   `tests/live-bats` must exist as a directory,
   `tests/live-bats/live-regression.bats` must exist as a regular file,
   `fixtures/confluence-7137/content/manifest.json`,
   `fixtures/confluence-7137/expected/live-commands.json`,
   `fixtures/confluence-7137/expected/live-command-expectations.json`, and
   `fixtures/confluence-7137/comparison-rules.json` must each exist as a
   regular file and decode as a UTF-8 JSON object, and each suite-root-relative
   source payload file required by `FR-0179` must exist as a regular file and
   decode as non-empty UTF-8 text.
3. If criterion 1 fails or if criterion 2 cannot evaluate or validate any
   required support path, no target access, fixture, expected-data, or live
   regression work is attempted, and the bootstrap phase fails before target
   preflight under `FR-0132` begins.
4. If `bootstrap_status=passed`, `fixture_apply_status=passed`, and
   `prepare_expected_data_status=passed`, `selftest` selects exactly
   one suite-root-relative live regression entrypoint file,
   `tests/live-bats/live-regression.bats`, and executes it exactly once
   against the prepared explicit Confluence target. If
   evaluating that file's metadata fails, if the file is not a regular file,
   or if the suite-root-relative path does not satisfy `FR-0150`, the live
   regression phase fails before starting Bats.
5. If `bootstrap_status`, `fixture_apply_status`, or
   `prepare_expected_data_status` is not `passed`, live regression suite
   selection and execution are not attempted and `live-bats.tap` exists and is
   empty.
6. If criterion 4 metadata evaluation, regular-file validation, or `FR-0150`
   path validation fails before Bats starts, live regression suite selection is
   attempted but live regression execution is not attempted and `live-bats.tap`
   exists and is empty.
7. When live regression execution is attempted, `live-bats.tap` begins with
   exactly one TAP comment line:
   `# live-bats-file tests/live-bats/live-regression.bats`.
8. `tests/live-bats/live-regression.bats` is the selected live regression file
   relative to the self-test suite root from criterion 1 and is serialized as a
   governed relative path under `FR-0150`.
9. `live-bats.tap` is UTF-8 text and, when non-empty, uses LF line endings.
10. Content after the required file-selection TAP comment prefix is captured Bats
   TAP output and is not governed by this requirements corpus except for being
   retained in `live-bats.tap`.
11. The live regression phase succeeds only when the selected file from
    criterion 4 is attempted exactly once, Bats starts successfully, Bats exits
    with process status `0`, `live-bats.tap` is retained according to
    criteria 7 through 10, and each retained case-specific comparison performed
    by the selected suite is checked only against the case-specific
    expected-data artifacts prepared under `FR-0144` and governed by
    `FR-0178`, `FR-0179`, `FR-0208`, and `FR-0209`. This card governs only that
    selected case-specific comparison contour together with `live-bats.tap`
    retention. No other retained artifact or lifecycle stdout or stderr output
    participates in the governed live-regression comparison.
12. The live regression phase fails if criterion 4 metadata evaluation or path
    validation fails, if Bats cannot be started, if Bats exits with any non-zero
    process status, if Bats is terminated by a signal, if the selected file is
    not attempted exactly once, if any retained case-specific comparison
    performed by the selected suite is checked against any artifact other than
    the case-specific expected-data artifacts prepared under `FR-0144` and
    governed by `FR-0178`, `FR-0179`, `FR-0208`, and `FR-0209`, or if
    `live-bats.tap` cannot be retained according to criteria 7 through 10.
13. The self-test harness imposes no live-regression timeout separate from the
    Bats process; live-regression failure or termination is determined only by
    criteria 11 and 12 and by actual external signal interruption of the Bats
    process itself.
14. Live regression execution starts exactly one Bats process with no shell
    interpolation, working directory equal to the self-test suite root from
    criterion 1, and argv vector
    `["bats", "--tap", "tests/live-bats/live-regression.bats"]`.
15. The Bats child process environment inherits the `selftest` process
    environment except that these variables are set or replaced for the current
    self-test invocation before Bats starts:
   `CONFLUEX_SELFTEST_SUITE_ROOT`, `CONFLUEX_SELFTEST_REPORT_ROOT`,
   `CONFLUEX_SELFTEST_CONFLUENCE_BASE_URL`,
   `CONFLUEX_SELFTEST_CONFLUENCE_USERNAME`, and
   `CONFLUEX_SELFTEST_CONFLUENCE_PASSWORD`.
16. `CONFLUEX_SELFTEST_SUITE_ROOT` is exactly the absolute self-test suite-root
    path from criterion 1, serialized without surrounding quotes or escaping.
17. `CONFLUEX_SELFTEST_REPORT_ROOT` is exactly the absolute selected self-test
    report-root path for the current invocation governed by `FR-0173`,
    serialized without surrounding quotes or escaping.
18. `CONFLUEX_SELFTEST_CONFLUENCE_BASE_URL` is exactly the target base URL from
    `FR-0132`.
19. `CONFLUEX_SELFTEST_CONFLUENCE_USERNAME` is exactly the target username from
    `FR-0132`.
20. `CONFLUEX_SELFTEST_CONFLUENCE_PASSWORD` is exactly the target password from
    `FR-0132`.
21. Each environment value from criteria 16 through 20 is non-empty.
22. Live regression commands executed by the harness perform only read
    operations against pages and attachments in the prepared explicit Confluence
    target and must not create, update, move, or delete Confluence
    spaces, pages, links, comments, labels, or attachments.
23. If any environment value required by criteria 15 through 21 is unavailable
    before Bats starts, the live regression phase fails before starting Bats.
24. Each `confluex` `export` or `plan` process launched by the live-regression
    harness passes the exact environment values from criteria 18 through 20
    unchanged as `CONFLUEX_SELFTEST_CONFLUENCE_BASE_URL`,
    `CONFLUEX_SELFTEST_CONFLUENCE_USERNAME`, and
    `CONFLUEX_SELFTEST_CONFLUENCE_PASSWORD` in that child process environment
    so that the selftest-harness access branch from `FR-0216` governs those
    invocations.
25. After the Bats process from criterion 14 exits or fails after criterion 14
    starts, `selftest` performs one post-live-regression fixture-invariant
    check sequence using only read operations against the prepared explicit
    Confluence target.
26. The criterion-25 check sequence attempts the fixture-invariant readback at
    most 10 times, stops immediately after the first attempt that returns
    `passed`, and waits exactly 1000 milliseconds between attempts that return
    `failed`.
27. The criterion-25 check sequence succeeds only when at least one attempted
    readback returns `passed` and the prepared fixture dataset in that explicit
    Confluence target still satisfies the canonical regression-graph obligations
    from `FR-0143`, `FR-0205`, `FR-0206`, and `FR-0207`.
28. If the criterion-25 check sequence is not attempted, cannot complete, or all
    attempts fail, the live regression phase fails.

**Dependencies**:
- `FR-0132`
- `FR-0136`
- `FR-0137`
- `FR-0144`
- `FR-0178`
- `FR-0179`
- `FR-0208`
- `FR-0209`
- `FR-0154`
- `FR-0152`
- `FR-0159`
- `FR-0150`
- `FR-0173`
- `FR-0216`
- `FR-0143`
- `FR-0205`
- `FR-0206`
- `FR-0207`

**Traceability**:
- Area: run lifecycle
- Observable evidence: live regression TAP report

### FR-0139
**Requirement**: Accepted `selftest` runs shall not manage Docker resources.

**Applicability**:
- accepted non-help `confluex selftest` invocations

**Rationale**:
- Maintainers need `selftest` to be independent from the external stand
  lifecycle and to avoid hidden local Docker side effects.

**Acceptance Criteria**:
1. `selftest` does not create, start, stop, inspect, list, or remove Docker
   containers, Docker volumes, or Docker networks during bootstrap, fixture
   application, expected-data preparation, live regression, reporting,
   successful completion, failed completion, or signal interruption.
2. `selftest` does not invoke a `docker` executable during any accepted
   invocation.
3. The lifecycle of the already-running Confluence target selected under
   `FR-0132` is external to `selftest`.

**Dependencies**:
- `FR-0132`

**Traceability**:
- Area: run lifecycle
- Observable evidence: absence of self-test Docker lifecycle side effects

### FR-0143
**Requirement**: The `confluence-7137` fixture dataset shall satisfy the
complete canonical regression-graph contract from `FR-0176` whenever fixture
application succeeds.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose fixture application is
  attempted

**Rationale**:
- Live regression tests need one requirements-owned read-only data graph with
  no successful fixture-application branch silently weakening or substituting
  the canonical dataset contract.

**Acceptance Criteria**:
1. If fixture application for the `confluence-7137` dataset reaches
   `fixture_apply_status=passed` under `FR-0136`, the resulting dataset
   satisfies every obligation in `FR-0176`.
2. No successful `confluence-7137` fixture-application branch may substitute,
   omit, or relax any logical-space, logical-page, logical-attachment,
   title, tree, source-content, or attachment-byte obligation defined by
   `FR-0176`.

**Dependencies**:
- `FR-0136`
- `FR-0176`

**Traceability**:
- Area: run lifecycle
- Observable evidence: fixture identities, live regression report artifacts,
  Confluence fixture content

### FR-0144
**Requirement**: Accepted `selftest` runs shall prepare deterministic
expected-data artifacts before live regression execution when prerequisite
phases pass.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose expected-data
  preparation is attempted

**Rationale**:
- Live regression assertions need stable command cases, expected artifact
  locations, comparison rules, and payload bytes tied to the prepared local
  Confluence 7.13.7 dataset.

**Acceptance Criteria**:
1. The source/control-file and `expected/` layout contract is governed by
   `FR-0177`.
2. The live command and expected-outcome schema contract is governed by
   `FR-0178`.
3. The expected page-payload artifact contract is governed by `FR-0179`.

**Dependencies**:
- `FR-0177`
- `FR-0178`
- `FR-0179`

**Traceability**:
- Area: run lifecycle
- Observable evidence: expected-data files and live regression assertions

### FR-0175
**Requirement**: The fixture dataset application contract shall retain the
fixture identity file for the canonical regression graph.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose fixture application is
  attempted

**Rationale**:
- Live regression tests need one requirements-owned read-only data graph with
  stable fixture identities.

**Acceptance Criteria**:
1. If `bootstrap_status=passed`, `selftest` prepares the project-owned
   `confluence-7137` fixture dataset in the explicit Confluence target governed
   by `FR-0132` from the preflight-validated
   suite-root-relative fixture bundle rooted at
   `fixtures/confluence-7137/content/manifest.json` governed by `FR-0138`
   before executing the governed live regression suite under `FR-0138`. If
   fixture application from that preflight-validated fixture bundle does not
   determine the canonical page identifiers required for every
   logical page from `FR-0176` together with the space, title, and attachment
   identities required by `FR-0205`, or does not satisfy the source-content
   obligations from `FR-0204` and `FR-0206` and the download-limit obligations
   from `FR-0207`, fixture dataset preparation fails.
2. If `bootstrap_status=failed`, fixture dataset preparation is not attempted.

**Dependencies**:
- `FR-0136`
- `FR-0132`
- `FR-0138`
- `FR-0176`
- `FR-0204`
- `FR-0205`
- `FR-0206`
- `FR-0207`

**Traceability**:
- Area: run lifecycle
- Observable evidence: fixture identities and fixture application artifacts

### FR-0176
**Requirement**: The `confluence-7137` fixture dataset shall model one canonical
regression graph.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose fixture application is
  attempted

**Rationale**:
- Live regression tests need one requirements-owned read-only data graph that
  covers tree traversal, link traversal, duplicate titles, cross-space links,
  unsupported patterns, download limits, Markdown export, HTML export, and
  attachments.

**Acceptance Criteria**:
1. The fixture dataset defines exactly two logical spaces:
   `fixture_space` and `aux_space`.
2. The fixture dataset defines exactly these logical pages: `root_page`,
   `child_page`, `grandchild_page`, `linked_page`, `linked_scope_root`,
   `linked_scope_linked_page`, `linked_scope_linked_descendant`,
   `linked_scope_link_of_link`, `ambiguous_root_page`, `scope_noise_root`,
   `cross_space_page`, `markdown_page`, `duplicate_title_primary`,
   `duplicate_title_secondary`, `download_limit_root_page`,
   `download_limit_child_a_page`, `download_limit_child_b_page`,
   `download_limit_child_c_page`, and `download_limit_child_d_page`.
3. `root_page`, `child_page`, `grandchild_page`, `linked_page`,
   `linked_scope_root`, `linked_scope_linked_page`,
   `linked_scope_linked_descendant`, `linked_scope_link_of_link`,
   `ambiguous_root_page`, `scope_noise_root`, `markdown_page`,
   `duplicate_title_primary`, `duplicate_title_secondary`,
   `download_limit_root_page`, `download_limit_child_a_page`,
   `download_limit_child_b_page`, `download_limit_child_c_page`, and
   `download_limit_child_d_page` belong to `fixture_space`.
4. `cross_space_page` belongs to `aux_space`.
5. `child_page` is a direct child of `root_page`.
6. `grandchild_page` is a direct child of `child_page`.
7. `download_limit_child_a_page`, `download_limit_child_b_page`,
   `download_limit_child_c_page`, and `download_limit_child_d_page` are direct
   children of `download_limit_root_page` in that child-listing order.
8. `linked_scope_linked_descendant` is a direct child of
   `linked_scope_linked_page`.
9. Source-content discovery-form and unsupported-pattern obligations for the
   fixture dataset are governed by `FR-0204`.
10. Space metadata, page titles, and attachment identity and byte-content
    obligations for the fixture dataset are governed by `FR-0205`.
11. Canonical page-body content obligations for the fixture dataset are governed
    by `FR-0206`.
12. Download-limit fixture-content obligations for the fixture dataset are
    governed by `FR-0207`.
13. Every logical page in the fixture dataset has exactly zero comments and
    exactly zero labels.

**Dependencies**:
- `FR-0014`
- `FR-0204`
- `FR-0205`
- `FR-0206`
- `FR-0207`

**Traceability**:
- Area: run lifecycle
- Observable evidence: fixture content, titles, attachments, comment/label
  state, and source serialization

### FR-0204
**Requirement**: The `confluence-7137` fixture dataset shall use one stable
source-content discovery contract.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose fixture application is
  attempted

**Rationale**:
- Live regression tests need one requirements-owned source-content contract for
  supported discovery forms and unsupported-pattern fixtures.

**Acceptance Criteria**:
1. `root_page` source content defines exactly these seven supported non-child
   links in this exact storage serialization order: `content_id` resolving to
   `linked_page` as
   `<ri:content-entity ri:content-id="<linked_page.page_id>"/>`;
   `page_ref` resolving to `linked_page` as
   `<ri:page ri:content-title="CX Linked"/>`; `macro_param` resolving to
   `linked_page` as
   `<ac:parameter ac:name="page">CX:CX Linked</ac:parameter>`;
   `href_page_id` resolving to `linked_page` as
   `<a href="/pages/<linked_page.page_id>">/pages/<linked_page.page_id></a>`;
   `href_space_title` resolving to `cross_space_page` with explicit space-key
   input `AUX` as
   `<a href="/display/AUX/AUX+Cross+Space">/display/AUX/AUX+Cross+Space</a>`;
   `ri_url_page_id` resolving to `linked_page` as
   `<ri:url ri:value="/pages/<linked_page.page_id>"/>`; and
   `ri_url_space_title` resolving to `cross_space_page` with explicit
   space-key input `AUX` as
   `<ri:url ri:value="/display/AUX/AUX+Cross+Space"/>`.
2. `linked_scope_root` source content defines exactly one supported non-child
   `content_id` link resolving to `linked_scope_linked_page`, serialized as
   `<ri:content-entity ri:content-id="<linked_scope_linked_page.page_id>"/>`.
3. `linked_scope_linked_page` source content defines exactly one supported
   non-child `content_id` link resolving to `linked_scope_link_of_link`,
   serialized as
   `<ri:content-entity ri:content-id="<linked_scope_link_of_link.page_id>"/>`.
4. `ambiguous_root_page` source content defines exactly one supported non-child
   `page_ref` link serialized as
   `<ri:page ri:content-title="Shared Fixture Title"/>`
   with no explicit `ri:space-key` input and no `ri:content-id` attribute; that
   title input matches both `duplicate_title_primary` and
   `duplicate_title_secondary`.
5. `markdown_page` source content defines exactly one supported non-child
   `macro_param` link resolving to `linked_page`, serialized as
   `<ac:parameter ac:name="page">CX:CX Linked</ac:parameter>`.
6. `scope_noise_root` source content defines no supported discovery forms and
   defines exactly these internal-looking or external-link noise values in
   Confluence storage format: an external absolute URL as the `href` attribute
   value on one `<a>` element,
   `https://example.invalid/confluence/display/CX/External`; internal-looking
   code-context text as the complete CDATA body of one
   `<ac:plain-text-body>` element inside one
   `<ac:structured-macro ac:name="code">` element, `/pages/424242`; and an
   unsupported internal-looking pattern as the `title` attribute value on one
   ordinary paragraph `<span>` element outside code/plain-text storage context,
   `/display/CX/Unsupported%20Pattern`, which must be reported under `FR-0066`.
7. No logical page source content defines any supported discovery form,
   unsupported internal-looking pattern, or external URL other than the values
   required by criteria 1 through 6.

**Dependencies**:
- `FR-0063`
- `FR-0066`

**Traceability**:
- Area: run lifecycle
- Observable evidence: fixture source-content discovery forms and unsupported
  patterns

### FR-0205
**Requirement**: The `confluence-7137` fixture dataset shall use one stable
space-title-attachment identity contract.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose fixture application is
  attempted

**Rationale**:
- Live regression tests need deterministic space metadata, page titles, and
  attachment identities for fixture-to-report comparisons.

**Acceptance Criteria**:
1. The fixture dataset defines exactly these logical attachments:
   `root_attachment` and `markdown_attachment`.
2. `root_attachment` belongs to `root_page`.
3. `markdown_attachment` belongs to `markdown_page`.
4. `fixture_space` has `space_key` exactly `CX` and `space_name` exactly
   `Confluex Fixture Space`.
5. `aux_space` has `space_key` exactly `AUX` and `space_name` exactly
   `Confluex Auxiliary Space`.
6. Logical page titles are exactly: `root_page` -> `CX Root`; `child_page` ->
   `CX Child`; `grandchild_page` -> `CX Grandchild`; `linked_page` ->
   `CX Linked`; `linked_scope_root` -> `CX Linked Scope Root`;
   `linked_scope_linked_page` -> `CX Linked Scope Linked`;
   `linked_scope_linked_descendant` -> `CX Linked Scope Descendant`;
   `linked_scope_link_of_link` -> `CX Link Of Link`; `ambiguous_root_page` ->
   `CX Ambiguous Root`; `scope_noise_root` -> `CX Scope Noise Root`;
   `cross_space_page` -> `AUX Cross Space`; `markdown_page` ->
   `CX Markdown Fixture`; `duplicate_title_primary` -> `Shared Fixture Title`;
   `duplicate_title_secondary` -> `Shared Fixture Title`; `download_limit_root_page` ->
   `CX Download Limit Root`; `download_limit_child_a_page` ->
   `CX Download A`; `download_limit_child_b_page` -> `CX Download B`;
   `download_limit_child_c_page` -> `CX Download C`; and
   `download_limit_child_d_page` -> `CX Download D`.
7. `root_attachment` has filename exactly `root-note.txt` and byte content
   exactly the UTF-8 bytes of `root attachment fixture` followed by LF.
8. `markdown_attachment` has filename exactly `markdown-note.txt` and byte
   content exactly the UTF-8 bytes of `markdown attachment fixture` followed by
   LF.

**Dependencies**:
- None

**Traceability**:
- Area: run lifecycle
- Observable evidence: fixture space metadata, page titles, and attachment
  identities

### FR-0206
**Requirement**: The `confluence-7137` fixture dataset shall use one stable
canonical page-body fixture contract.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose fixture application is
  attempted

**Rationale**:
- Live regression tests need deterministic canonical page bodies for content and
  traversal assertions.

**Acceptance Criteria**:
1. For this card, source-content conformance is determined from one logical
   page's exact Confluence storage-format XML string after fixture application
   and before product processing. Within that exact source string, a heading is
   one `<h1>` element, a paragraph is one `<p>` element, an unordered list is
   one `<ul>` element with its `<li>` items in source order, a table is one
   `<table>` element with header cells from `<th>` elements in source order and
   body cells from `<td>` elements in row-major source order, a code block is
   one `<ac:structured-macro ac:name="code">` element with one
   `<ac:plain-text-body>` child whose complete CDATA body is the code-block
   text, an inline-code construct is one `<code>` element, and no supported
   discovery form means no storage serialization required or forbidden by
   `FR-0204` appears anywhere in that source string.
2. `markdown_page` source content contains exactly one heading with text
   `Markdown Fixture`, exactly one paragraph with text `Paragraph fixture text.`,
   exactly one unordered list with item texts `First bullet` and
   `Second bullet` in that order, exactly one Confluence table with header cells
   `Column A` and `Column B` and one body row with cells `Cell A1` and
   `Cell B1`, exactly one code block with text `console.log(\"fixture\");`, and
   exactly one additional paragraph whose complete content is the serialized
   `markdown_page` supported non-child link governed by `FR-0204`; it contains
   no other heading,
   paragraph, list, table, inline-code, or code-block constructs.
3. `duplicate_title_primary` source content contains exactly one paragraph with
   text `Duplicate primary fixture page.` and contains no supported discovery
   form.
4. `root_page` source content contains exactly one unordered list with seven
   items in the `root_page` supported non-child link order governed by
   `FR-0204`; each item contains exactly one serialized supported link from
   that same `FR-0204` contract, contains no text outside that link, and
   `root_page` contains no other heading, paragraph, list, table, inline-code,
   or code-block construct.
5. `child_page` source content contains exactly one paragraph with text
   `Child fixture page.` and contains no supported discovery form.
6. `grandchild_page` source content contains exactly one paragraph with text
   `Grandchild fixture page.` and contains no supported discovery form.
7. `linked_page` source content contains exactly one paragraph with text
   `Linked fixture page.` and contains no supported discovery form.
8. `cross_space_page` source content contains exactly one paragraph with text
   `Cross-space fixture page.` and contains no supported discovery form.
9. `duplicate_title_secondary` source content contains exactly one paragraph
   with text `Duplicate secondary fixture page.` and contains no supported
   discovery form.
10. `linked_scope_root` source content contains exactly one unordered list with
   one item whose complete content is the `linked_scope_root` supported
   non-child link governed by `FR-0204` and no other text or supported
   discovery form, and contains no other heading, paragraph, list, table,
   inline-code, or code-block construct.
11. `linked_scope_linked_page` source content contains exactly one unordered
    list with one item whose complete content is the serialized supported link
    governed for `linked_scope_linked_page` by `FR-0204` and no other text or
    supported discovery form, and contains no other heading, paragraph, list,
    table, inline-code, or code-block construct.
12. `linked_scope_linked_descendant` source content contains exactly one
    paragraph with text `Linked-scope descendant fixture page.` and contains no
    supported discovery form.
13. `linked_scope_link_of_link` source content contains exactly one paragraph
    with text `Link-of-link fixture page.` and contains no supported discovery
    form.
14. `ambiguous_root_page` source content contains exactly one paragraph whose
    complete content is the serialized supported link
    `<ri:page ri:content-title="Shared Fixture Title"/>` and no other text or
    supported discovery form, and contains no other heading, paragraph, list,
    table, inline-code, or code-block construct.

**Dependencies**:
- `FR-0204`

**Traceability**:
- Area: run lifecycle
- Observable evidence: canonical fixture page bodies

### FR-0207
**Requirement**: The `confluence-7137` fixture dataset shall use one stable
download-limit fixture-content contract.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose fixture application is
  attempted

**Rationale**:
- Live regression tests need deterministic oversized and limited child payloads
  for download-limit assertions.

**Acceptance Criteria**:
1. `download_limit_root_page` source content contains exactly one paragraph
   whose text is exactly 1200000 ASCII uppercase `R` characters and contains no
   supported discovery form.
2. `download_limit_child_a_page`, `download_limit_child_b_page`,
   `download_limit_child_c_page`, and `download_limit_child_d_page` each
   contain exactly one paragraph whose text is exactly 2048 ASCII uppercase
   `A`, `B`, `C`, and `D` characters, respectively, and each page contains no
   supported discovery form.

**Dependencies**:
- None

**Traceability**:
- Area: run lifecycle
- Observable evidence: download-limit fixture payload content

### FR-0177
**Requirement**: The expected-data source/control-file and `expected/` layout
contract shall produce deterministic source-file copies and cleanup for
expected-data preparation.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose expected-data
  preparation is attempted

**Rationale**:
- Maintainers and automation need predictable source-file staging and cleanup
  for the expected-data tree.

**Acceptance Criteria**:
1. Expected-data preparation uses these preflight-validated source files
   relative to the self-test suite root governed by `FR-0138`:
   `fixtures/confluence-7137/expected/live-commands.json`,
   `fixtures/confluence-7137/expected/live-command-expectations.json`, and
   `fixtures/confluence-7137/comparison-rules.json`.
2. The retained self-test report root contains byte-for-byte copies of the
   source files from criterion 1 at `expected/live-commands.json`,
   `expected/live-command-expectations.json`, and
   `expected/comparison-rules.json`, respectively.
3. Each source control file from criterion 1 and each retained copy from
   criterion 2 is a UTF-8 JSON object serialized with no byte order mark, no
   duplicate object member names anywhere in the document, no whitespace
   outside JSON string values except exactly one final LF after the top-level
   object, and no bytes after that LF.
4. The source and retained copies of `comparison-rules.json` from criteria 1
   and 2 are exactly the empty JSON object `{}` followed by one final LF.
5. `comparison-rules.json` is a harness-owned convenience input whose exact
   empty-object content from criterion 4 does not alter the authoritative
   live-regression command cases and expected outcomes governed by `FR-0178`,
   the authoritative expected payload bytes governed by `FR-0179`, case
   membership, compared-artifact selection, serialization expectations,
   normalization rules, pass-or-fail thresholds, or any other
   outcome-determining behavior under this requirements corpus.
6. Expected-data preparation fails if any preflight-validated source control
   file from criterion 1 cannot be copied byte-for-byte to its retained path
   from criterion 2.
7. The source and retained copies of `live-commands.json` from criteria 1 and 2
   satisfy the `live-commands.json` schema, suite-entrypoint value, and
   governed case-list obligations from `FR-0178`.
8. The source and retained copies of `live-command-expectations.json` from
   criteria 1 and 2 satisfy the `live-command-expectations.json` schema and
   governed case-expectation obligations from `FR-0178` together with the
   detailed matrix obligations from `FR-0208` and `FR-0209`.
9. The source and retained copies of `comparison-rules.json` from criteria 1
   and 2 do not add, remove, rename, reorder, or redefine any governed case,
   expectation field, payload-oracle membership, attachment expectation,
   manifest expectation, resolved-link expectation, unresolved-link
   expectation, failed-page expectation, summary expectation, or scope-finding
   expectation defined by `FR-0178`, `FR-0179`, `FR-0208`, or `FR-0209`.
10. When expected-data preparation passes, the `expected/` directory contains
   exactly these direct entries: `live-commands.json`,
   `live-command-expectations.json`, `comparison-rules.json`, and `payloads/`.
11. If removing an extra entry or creating/writing a required entry under
   `expected/` fails while expected-data preparation is attempted,
   `prepare_expected_data_status=failed` under `FR-0136`.
12. If expected-data preparation fails after creating any entry under `expected/`,
   the product removes every entry under `expected/` before final self-test
   report retention so that failed expected-data preparation leaves `expected/`
   existing and containing no entries.
13. If cleanup required by criterion 12 fails, `selftest` takes the self-test
   report-root failure branch governed by `FR-0174`.
14. Every source path in criterion 1, retained copy path in criterion 2, and
    report-root-relative path required by `FR-0179` is serialized as a governed
    relative path under `FR-0150`.
15. Expected payload preparation reads only the suite-root-relative source
    payload files governed by `FR-0179` and does not read product output
    generated by the live regression commands it is preparing to check.
16. If expected-data preparation cannot produce any required artifact from
    criteria 1 through 15 after the source-file preflight required by
    `FR-0138` has passed, `prepare_expected_data_status=failed`
    under `FR-0136` and live regression execution is not attempted under
    `FR-0138`.

**Dependencies**:
- `FR-0136`
- `FR-0138`
- `FR-0150`
- `FR-0173`
- `FR-0174`
- `FR-0178`
- `FR-0179`
- `FR-0208`
- `FR-0209`

**Traceability**:
- Area: run lifecycle
- Observable evidence: expected-data source files, staging layout, and cleanup

### FR-0178
**Requirement**: The expected-data live command and expectation schema shall
encode one closed selected live-regression case set and its required outcome
classes.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose expected-data
  preparation is attempted

**Rationale**:
- Live regression assertions need one stable selected case matrix, expected
  artifact locations, comparison rules, and payload bytes tied to the prepared
  local Confluence 7.13.7 dataset.

**Acceptance Criteria**:
1. `live-commands.json` contains exactly two top-level keys in this order:
   `suite_entrypoint` and `cases`.
2. `suite_entrypoint` is exactly the governed relative path
   `tests/live-bats/live-regression.bats`.
3. `cases` is a closed array of exactly these eight selected case objects in
   this exact order:
   `plan-root-page`, `plan-scope-noise-root`, `plan-ambiguous-root`,
   `export-root-page-md`, `export-root-page-html`,
   `export-markdown-page-md`, `export-linked-scope-root-md`, and
   `export-download-limit-root-md`. Case membership and case order are
   authoritative only in this criterion; `FR-0208` and `FR-0209` define
   expectation content for the cases named here and do not redefine membership
   or order.
4. Each object in `cases` from criterion 3 contains exactly these keys in this
   order: `case_id`, `command`, `argv`, and `artifact_bucket`. `command` is
   the authoritative CLI subcommand token for that case, and `argv` is the
   exact argv vector passed after the `confluex` program path; `argv` contains
   at least one element, its first element is exactly the same token as
   `command`, and any case object that would violate that equality is invalid.
5. In `live-commands.json`, `argv` array elements may use only the placeholder
   token forms `<page-id:<logical_page_name>>` and
   `<report-root-subdir:<relative_path>>`. For `<page-id:<logical_page_name>>`,
   `<logical_page_name>` is one logical page name governed by `FR-0176`; at harness
   execution time, each such placeholder resolves to the `page_id` value for
   that logical page from the retained `identities.json` fixture-identity file
   in the self-test report root. For
   `<report-root-subdir:<relative_path>>`, `<relative_path>` is one governed
   relative path under `FR-0150`; at harness execution time, each such
   placeholder resolves to the absolute path formed by joining that relative
   path to the selected self-test report root from `FR-0173`. No other
   placeholder form is permitted.
6. The case objects from criterion 3 use exactly these values, and if a case
   invocation retains a run artifact then that retained artifact root is located
   exactly at the report-root-relative path `<artifact_bucket>/<case_id>`:
   `plan-root-page` -> `command=plan`,
   `argv=["plan","--page-id","<page-id:root_page>","--out","<report-root-subdir:plan/plan-root-page>"]`,
   `artifact_bucket=plan`;
   `plan-scope-noise-root` -> `command=plan`,
   `argv=["plan","--page-id","<page-id:scope_noise_root>","--out","<report-root-subdir:plan/plan-scope-noise-root>"]`,
   `artifact_bucket=plan`;
   `plan-ambiguous-root` -> `command=plan`,
   `argv=["plan","--page-id","<page-id:ambiguous_root_page>","--out","<report-root-subdir:plan/plan-ambiguous-root>"]`,
   `artifact_bucket=plan`;
   `export-root-page-md` -> `command=export`,
   `argv=["export","--page-id","<page-id:root_page>","--page-format","md","--out","<report-root-subdir:export/export-root-page-md>"]`,
   `artifact_bucket=export`;
   `export-root-page-html` -> `command=export`,
   `argv=["export","--page-id","<page-id:root_page>","--page-format","html","--out","<report-root-subdir:export/export-root-page-html>"]`,
   `artifact_bucket=export`;
   `export-markdown-page-md` -> `command=export`,
   `argv=["export","--page-id","<page-id:markdown_page>","--page-format","md","--out","<report-root-subdir:export/export-markdown-page-md>"]`,
   `artifact_bucket=export`;
   `export-linked-scope-root-md` -> `command=export`,
   `argv=["export","--page-id","<page-id:linked_scope_root>","--page-format","md","--out","<report-root-subdir:export/export-linked-scope-root-md>"]`,
   `artifact_bucket=export`; and
   `export-download-limit-root-md` -> `command=export`,
   `argv=["export","--page-id","<page-id:download_limit_root_page>","--page-format","md","--max-download-mib","1","--out","<report-root-subdir:export/export-download-limit-root-md>"]`,
   `artifact_bucket=export`.
7. `live-command-expectations.json` contains exactly one top-level key,
   `cases`.
8. The `cases` object from criterion 7 contains exactly these eight member
   names in this exact order: `plan-root-page`, `plan-scope-noise-root`,
   `plan-ambiguous-root`, `export-root-page-md`, `export-root-page-html`,
   `export-markdown-page-md`, `export-linked-scope-root-md`, and
   `export-download-limit-root-md`.
9. Each case-expectation object in `live-command-expectations.json` contains
   exactly these keys in this exact order: `expected_exit_code`,
   `expected_final_status`, `expected_page_payload_format`, `expected_summary`,
   `expected_downloaded_mib`, `expected_manifest_rows`,
   `expected_payload_oracles`, `expected_scope_findings`,
   `expected_resolved_links`, `expected_unresolved_links`,
   `expected_failed_pages`, and `expected_attachment_files`.
10. `expected_exit_code` is a canonical non-negative integer governed by
    `FR-0014` and equals the CLI exit code required by `FR-0118` for that
    case's governed invocation outcome; `expected_final_status` uses the
    `final_status` vocabulary from `FR-0113`; and
    `expected_page_payload_format` uses only the JSON string values `none`,
    `md`, or `html`, where `none` denotes the plan-mode no-payload case from
    `FR-0119` rather than the bare whole-value absence serialization governed
    by `FR-0125`.
11. In `live-command-expectations.json`, JSON string expectation fields may use
   only the placeholder token forms `<page-id:<logical_page_name>>` and
   `<report-root-subdir:<relative_path>>`. At harness execution time these
   placeholder forms resolve using the same rules as criterion 5.
   `expected_summary.page_id` uses the page-id placeholder,
   `expected_summary.output_root` uses the report-root-subdir placeholder, but
   for that field the resolved absolute path is then serialized as the exact
   quoted path string required by `FR-0124`, and
   `expected_manifest_rows.folder`, `expected_payload_oracles.relative_path`,
   and `expected_attachment_files.relative_path` may embed page-id
   placeholders only inside canonical `page__<page_id>` path segments required
   by `FR-0079`, and `expected_resolved_links` or
   `expected_unresolved_links` `raw_link_value` strings may embed the
   page-id placeholder only where the authoritative `raw_link_value` form from
   `FR-0087` contains a page-id input. No other placeholder use is permitted
   in expectation strings.
12. `expected_summary` is a JSON object with exactly these keys in this exact
    order: `command`, `support_profile`, `scope_trust`,
    `output_path_provenance`, `blocking_reasons`, `interrupt_reason`,
    `resume_mode`, `resume_schema_version`, `processed_pages`, `root_pages`,
    `tree_pages`, `linked_pages`, `other_pages`, `resolved_links`,
    `unresolved_links`, `scope_findings`, `failed_operations`,
    `reused_pages`, `fresh_pages`, `output_root`, `page_id`,
    `encryption_enabled`, and `encryption_successful`.
13. In `expected_summary`, `command`, `support_profile`, `scope_trust`,
    `output_path_provenance`, `blocking_reasons`, and `interrupt_reason` use
    the vocabularies from `FR-0119`, `FR-0114`, `FR-0115`, `FR-0116`, and
    `FR-0140`; `processed_pages`, `root_pages`, `tree_pages`, `linked_pages`,
    `other_pages`, `resolved_links`, `unresolved_links`, `scope_findings`,
    `failed_operations`, `reused_pages`, and `fresh_pages` are canonical
    non-negative integers governed by `FR-0014`; `resume_mode`,
    `encryption_enabled`, and `encryption_successful` use only the JSON integer
    values `0` or `1`; `resume_schema_version` is exactly the JSON integer `2`;
    `page_id` uses the placeholder form from criterion 11; and `output_root`
    uses the placeholder form from criterion 11 and resolves to the exact
    `FR-0124` quoted path string required by `FR-0119`. The top-level
    `expected_final_status` and `expected_page_payload_format` values from
    criterion 10 and the top-level `expected_downloaded_mib` value from
    criterion 14 also govern the same-named retained `summary.txt` values for
    that case. Together, `expected_summary`, `expected_final_status`,
    `expected_page_payload_format`, and `expected_downloaded_mib` define the
    governed retained `summary.txt` invariants for that case: the retained
    physical lines use the exact key set, key order, LF-bounded `key=value`
    serialization, and no-additional-bytes contract from `FR-0090`, while
    criterion 14 governs only the allowed value class of each retained
    `downloaded_mib_*` line and not its exact decimal magnitude.
14. `expected_downloaded_mib` is a JSON object with exactly these keys in this
    exact order: `total`, `content`, and `metadata`. Each value uses only
    `zero` or `positive`. `zero` means the corresponding retained summary field
    is exactly `0.000`. `positive` means the corresponding retained summary
    field is greater than `0.000` and uses the exact three-decimal
    serialization required by `FR-0120`. This expectation field intentionally
    does not encode exact decimal magnitudes because those exact upstream byte
    volumes are not fixed by this selected case corpus; instead it governs only
    the retained `downloaded_mib_*` line presence, key placement, exact zero
    rendering, exact positive-value serialization shape, and zero-vs-positive
    classification for that case.
15. `expected_manifest_rows` is an array of zero or more objects sorted in
    ascending bytewise lexicographic order of `page` so the expectation file
    remains stable even when resolved fixture page identifiers vary across
    self-test runs. Each object contains exactly these keys in this exact
    order: `page`, `space_key`, `page_title`, `folder`, `discovery_source`,
    `run_mode`, and
    `attachment_count`, where `page` is one logical page name governed by
    `FR-0176`, `space_key`, `page_title`, `folder`, `discovery_source`,
    `run_mode`, and `attachment_count` use the authoritative `manifest.tsv`
    field serializations and vocabularies from `FR-0086`, and the exact JSON
    string `none` denotes the shared absence token where `FR-0086` would
    serialize the bare field value `none`. Each object denotes one complete
    retained `manifest.tsv` row, and the array denotes the complete expected
    set of such rows for that case. For retained `manifest.tsv` comparison, the
    authoritative expected row order is the exact row order required by
    `FR-0086` after substituting the resolved `page_id` value for `page` from
    the retained `identities.json` fixture-identity file and after resolving
    any allowed page-id placeholders embedded in `folder`; the authoritative
    expected file text is the exact `FR-0086` header row followed by those
    data rows as LF-terminated TSV lines and no additional bytes.
16. `expected_payload_oracles` is an array of zero or more objects sorted in
    ascending bytewise lexicographic order of the tuple
    (`page`, `relative_path`). Each object contains exactly these keys in this
    exact order: `page` and `relative_path`, where `page` is one logical page
    name governed by `FR-0176` and `relative_path` is the exact retained
    governed relative path under `FR-0150` to that page's retained payload
    file. For each object,
    `relative_path` equals that case's retained `manifest.tsv` `folder` value
    for `page` joined with `page.md` or `page.html` according to that case's
    `expected_page_payload_format`. The array denotes the complete expected set
    of retained payload files whose bytes must match the expected payload
    artifacts governed by `FR-0179` for that case. Across all governed cases in
    this corpus, criterion 6 case argv never includes `--keep-metadata`;
    therefore no case expects `_info.txt`, `_storage.xml`, or
    `_attachments_preview.txt`. Together, the case command from criterion 6,
    `expected_manifest_rows`, `expected_payload_oracles`, and
    `expected_attachment_files` define the complete retained top-level,
    per-page folder, payload-file, and attachment-file membership required by
    `FR-0077`, `FR-0078`, `FR-0080`, and `FR-0081`; no other governed entry may
    remain for that case.
17. In criteria 18 through 21, each object denotes one complete retained TSV
    report row for the corresponding report file. The JSON array order is the
    stable logical-page surrogate order defined by the criterion itself. For
    retained report-file comparison, the authoritative expected TSV row order
    is still the exact row ordering from `FR-0087`, `FR-0088`, or `FR-0089`
    after substituting any logical page name with the resolved `page_id` from
    the retained `identities.json` fixture-identity file and after resolving
    any allowed page-id placeholders embedded in string fields. For each
    corresponding retained report file, the authoritative expected file text is
    the exact header literal and LF-bounded TSV serialization required by
    `FR-0087`, `FR-0088`, or `FR-0089`, with the complete expected data-row set
    given by that file's corresponding expectation array and no additional
    bytes.
18. `expected_scope_findings` is an array of zero or more objects sorted in
    ascending bytewise lexicographic order of the tuple
    (`page`, `finding_area`, `finding_type`, `detail`). Each object contains
    exactly these keys in this exact order: `page`, `finding_area`,
    `finding_type`, and `detail`, where `page` is either one logical page name
    governed by `FR-0176` or the exact JSON string `none` when the governed
    retained row uses `page_id=none` under `FR-0089`, `finding_area` and
    `finding_type` use the vocabularies from `FR-0089`, and `detail` uses the
    authoritative scope-finding `detail` serialization from `FR-0089`. The
    array denotes the complete expected set of retained `scope-findings.tsv`
    rows for that case.
19. `expected_resolved_links` is an array of zero or more objects sorted in
    ascending bytewise lexicographic order of the tuple
    (`source_page`, `link_kind`, `raw_link_value`, `target_page`). Each object
    contains exactly these keys in this exact order: `source_page`,
    `source_title`, `link_kind`, `raw_link_value`, `target_page`,
    `target_space_key`, and `target_title`, where `source_page` and
    `target_page` are logical page names governed by `FR-0176`,
    `source_title`, `raw_link_value`, `target_space_key`, and `target_title`
    use the authoritative resolved-link field serializations from `FR-0087`,
    and the exact JSON string `none` denotes the resolved-link field value
    governed by the shared absence token. The array denotes the complete
    expected set of retained `resolved-links.tsv` rows for that case.
20. `expected_unresolved_links` is an array of zero or more objects sorted in
    ascending bytewise lexicographic order of the tuple
    (`source_page`, `link_kind`, `raw_link_value`, `resolution_reason`). Each
    object contains exactly these keys in this exact order: `source_page`,
    `source_title`, `link_kind`, `raw_link_value`, and `resolution_reason`,
    where `source_page` is one logical page name governed by `FR-0176`,
    `source_title` uses the authoritative unresolved-link `source_title` field
    serialization from `FR-0087`, `link_kind` and `resolution_reason` use the
    vocabularies from `FR-0087`, and `raw_link_value` uses the authoritative
    unresolved-link serialization from `FR-0087`. The array denotes the
    complete expected set of retained `unresolved-links.tsv` rows for that
    case.
21. `expected_failed_pages` is an array of zero or more objects sorted in
    ascending bytewise lexicographic order of the tuple
    (`page`, `page_title`, `operation`, `error_summary`). Each object contains
    exactly these keys in this exact order: `page`, `page_title`, `operation`,
    and `error_summary`, where `page` is either one logical page name governed
    by `FR-0176` or the exact JSON string `none` when the governed retained row
    uses `page_id=none` under `FR-0088`, and `page_title`, `operation`, and
    `error_summary` use the authoritative failed-pages field serializations and
    vocabularies from `FR-0088`. The array denotes the complete expected set of
    retained `failed-pages.tsv` rows for that case.
22. `expected_attachment_files` is an array of zero or more objects sorted in
    ascending bytewise lexicographic order of the tuple
    (`page`, `relative_path`). Each object contains exactly these keys in this
    exact order: `page`, `filename`, and `relative_path`, where `page` is one
    logical page name governed by `FR-0176`, `filename` is the exact retained
    attachment filename expected for that page, and `relative_path` is the
    exact retained governed relative path under `FR-0150` to that attachment
    payload file. For each object, `relative_path` equals that case's retained
    `manifest.tsv` `folder` value for `page` joined with `attachments/` and
    `filename`. The array denotes the complete expected set of retained
    attachment payload files for that case, and each retained attachment's
    bytes match the authoritative attachment content for that logical
    attachment from `FR-0205`.
23. Detailed plan-case expectation matrices are governed by `FR-0208`.
24. Detailed export-case expectation matrices are governed by `FR-0209`.

**Dependencies**:
- `FR-0014`
- `FR-0183`
- `FR-0077`
- `FR-0074`
- `FR-0075`
- `FR-0078`
- `FR-0079`
- `FR-0080`
- `FR-0081`
- `FR-0086`
- `FR-0087`
- `FR-0088`
- `FR-0089`
- `FR-0090`
- `FR-0092`
- `FR-0118`
- `FR-0113`
- `FR-0114`
- `FR-0115`
- `FR-0116`
- `FR-0117`
- `FR-0119`
- `FR-0120`
- `FR-0124`
- `FR-0125`
- `FR-0121`
- `FR-0140`
- `FR-0150`
- `FR-0173`
- `FR-0175`
- `FR-0176`
- `FR-0205`
- `FR-0208`
- `FR-0209`
- `FR-0179`

**Traceability**:
- Area: run lifecycle
- Observable evidence: expected-data schema and retained live regression
  expectations

### FR-0208
**Requirement**: The self-test expected-data corpus shall use one stable plan-case
expectation matrix.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose expected-data
  preparation is attempted

**Rationale**:
- Live regression tests need deterministic expected outcomes for the governed
  plan cases.

**Acceptance Criteria**:
1. The `plan-root-page` expectation object uses `expected_exit_code=0`,
   `expected_final_status=success`, `expected_page_payload_format=none`,
   `expected_summary={"command":"plan","support_profile":"default","scope_trust":"trusted","output_path_provenance":"explicit","blocking_reasons":"none","interrupt_reason":"none","resume_mode":0,"resume_schema_version":2,"processed_pages":5,"root_pages":1,"tree_pages":2,"linked_pages":2,"other_pages":0,"resolved_links":9,"unresolved_links":0,"scope_findings":0,"failed_operations":0,"reused_pages":0,"fresh_pages":5,"output_root":"<report-root-subdir:plan/plan-root-page>","page_id":"<page-id:root_page>","encryption_enabled":0,"encryption_successful":0}`,
   `expected_downloaded_mib={"total":"positive","content":"zero","metadata":"positive"}`,
   `expected_manifest_rows=[{"page":"child_page","space_key":"CX","page_title":"CX Child","folder":"none","discovery_source":"tree","run_mode":"plan","attachment_count":"0"},{"page":"cross_space_page","space_key":"AUX","page_title":"AUX Cross Space","folder":"none","discovery_source":"linked","run_mode":"plan","attachment_count":"0"},{"page":"grandchild_page","space_key":"CX","page_title":"CX Grandchild","folder":"none","discovery_source":"tree","run_mode":"plan","attachment_count":"0"},{"page":"linked_page","space_key":"CX","page_title":"CX Linked","folder":"none","discovery_source":"linked","run_mode":"plan","attachment_count":"0"},{"page":"root_page","space_key":"CX","page_title":"CX Root","folder":"none","discovery_source":"root","run_mode":"plan","attachment_count":"1"}]`,
   `expected_payload_oracles=[]`,
   `expected_scope_findings=[]`,
   `expected_resolved_links=[{"source_page":"child_page","source_title":"CX Child","link_kind":"child_result","raw_link_value":"page_id:<page-id:grandchild_page>","target_page":"grandchild_page","target_space_key":"CX","target_title":"CX Grandchild"},{"source_page":"root_page","source_title":"CX Root","link_kind":"child_result","raw_link_value":"page_id:<page-id:child_page>","target_page":"child_page","target_space_key":"CX","target_title":"CX Child"},{"source_page":"root_page","source_title":"CX Root","link_kind":"content_id","raw_link_value":"page_id:<page-id:linked_page>","target_page":"linked_page","target_space_key":"CX","target_title":"CX Linked"},{"source_page":"root_page","source_title":"CX Root","link_kind":"href_page_id","raw_link_value":"page_id:<page-id:linked_page>","target_page":"linked_page","target_space_key":"CX","target_title":"CX Linked"},{"source_page":"root_page","source_title":"CX Root","link_kind":"href_space_title","raw_link_value":"space_key_present=1;space_key_bytes=3;space_key=AUX;title_bytes=15;title=AUX Cross Space","target_page":"cross_space_page","target_space_key":"AUX","target_title":"AUX Cross Space"},{"source_page":"root_page","source_title":"CX Root","link_kind":"macro_param","raw_link_value":"space_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=9;title=CX Linked","target_page":"linked_page","target_space_key":"CX","target_title":"CX Linked"},{"source_page":"root_page","source_title":"CX Root","link_kind":"page_ref","raw_link_value":"space_key_present=0;space_key_bytes=0;space_key=;title_bytes=9;title=CX Linked","target_page":"linked_page","target_space_key":"CX","target_title":"CX Linked"},{"source_page":"root_page","source_title":"CX Root","link_kind":"ri_url_page_id","raw_link_value":"page_id:<page-id:linked_page>","target_page":"linked_page","target_space_key":"CX","target_title":"CX Linked"},{"source_page":"root_page","source_title":"CX Root","link_kind":"ri_url_space_title","raw_link_value":"space_key_present=1;space_key_bytes=3;space_key=AUX;title_bytes=15;title=AUX Cross Space","target_page":"cross_space_page","target_space_key":"AUX","target_title":"AUX Cross Space"}]`,
   `expected_unresolved_links=[]`, `expected_failed_pages=[]`,
   and `expected_attachment_files=[]`.
2. The `plan-scope-noise-root` expectation object uses `expected_exit_code=0`,
   `expected_final_status=success_with_findings`,
   `expected_page_payload_format=none`,
   `expected_summary={"command":"plan","support_profile":"default","scope_trust":"degraded","output_path_provenance":"explicit","blocking_reasons":"scope_findings","interrupt_reason":"none","resume_mode":0,"resume_schema_version":2,"processed_pages":1,"root_pages":1,"tree_pages":0,"linked_pages":0,"other_pages":0,"resolved_links":0,"unresolved_links":0,"scope_findings":1,"failed_operations":0,"reused_pages":0,"fresh_pages":1,"output_root":"<report-root-subdir:plan/plan-scope-noise-root>","page_id":"<page-id:scope_noise_root>","encryption_enabled":0,"encryption_successful":0}`,
   `expected_downloaded_mib={"total":"positive","content":"zero","metadata":"positive"}`,
   `expected_manifest_rows=[{"page":"scope_noise_root","space_key":"CX","page_title":"CX Scope Noise Root","folder":"none","discovery_source":"root","run_mode":"plan","attachment_count":"0"}]`,
   `expected_payload_oracles=[]`,
   `expected_scope_findings=[{"page":"scope_noise_root","finding_area":"unsupported_pattern","finding_type":"unsupported_internal_pattern","detail":"/display/CX/Unsupported%20Pattern"}]`,
   `expected_resolved_links=[]`, `expected_unresolved_links=[]`,
   `expected_failed_pages=[]`, and `expected_attachment_files=[]`.
3. The `plan-ambiguous-root` expectation object uses `expected_exit_code=0`,
   `expected_final_status=success_with_findings`,
   `expected_page_payload_format=none`,
   `expected_summary={"command":"plan","support_profile":"default","scope_trust":"degraded","output_path_provenance":"explicit","blocking_reasons":"unresolved_links","interrupt_reason":"none","resume_mode":0,"resume_schema_version":2,"processed_pages":1,"root_pages":1,"tree_pages":0,"linked_pages":0,"other_pages":0,"resolved_links":0,"unresolved_links":1,"scope_findings":0,"failed_operations":0,"reused_pages":0,"fresh_pages":1,"output_root":"<report-root-subdir:plan/plan-ambiguous-root>","page_id":"<page-id:ambiguous_root_page>","encryption_enabled":0,"encryption_successful":0}`,
   `expected_downloaded_mib={"total":"positive","content":"zero","metadata":"positive"}`,
   `expected_manifest_rows=[{"page":"ambiguous_root_page","space_key":"CX","page_title":"CX Ambiguous Root","folder":"none","discovery_source":"root","run_mode":"plan","attachment_count":"0"}]`,
   `expected_payload_oracles=[]`,
   `expected_scope_findings=[]`,
   `expected_resolved_links=[]`,
   `expected_unresolved_links=[{"source_page":"ambiguous_root_page","source_title":"CX Ambiguous Root","link_kind":"page_ref","raw_link_value":"space_key_present=0;space_key_bytes=0;space_key=;title_bytes=20;title=Shared Fixture Title","resolution_reason":"not_unique"}]`,
   `expected_failed_pages=[]`, and `expected_attachment_files=[]`.

**Dependencies**:
- `FR-0086`
- `FR-0087`
- `FR-0088`
- `FR-0089`
- `FR-0090`
- `FR-0092`
- `FR-0118`
- `FR-0113`
- `FR-0114`
- `FR-0115`
- `FR-0116`
- `FR-0117`
- `FR-0119`
- `FR-0120`
- `FR-0140`
- `FR-0176`
- `FR-0205`
- `FR-0178`

**Traceability**:
- Area: run lifecycle
- Observable evidence: governed plan-case expected outcomes

### FR-0209
**Requirement**: The self-test expected-data corpus shall use one stable
export-case expectation matrix.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose expected-data
  preparation is attempted

**Rationale**:
- Live regression tests need deterministic expected outcomes for the governed
  export cases.

**Acceptance Criteria**:
1. The governed export-case expectation matrix is the UTF-8 JSON object stored
   at `fixtures/confluence-7137/expected/live-command-expectations.json`. That
   object contains exactly the top-level keys `doctor`, `plan`, `export`, and
   `export_html`, in that order, and no other top-level key.
2. The `doctor` object uses exactly the keys `page_access`,
   `encryption_recipient`, `support_profile`, and `supported_link_forms`, with
   exactly these values: `page_access=ok`,
   `encryption_recipient=skipped`, `support_profile=default`, and
   `supported_link_forms=child_result,content_id,page_ref,macro_param,href_page_id,href_space_title,ri_url_page_id,ri_url_space_title`.
3. The `plan` object uses exactly the keys `summary`, `manifest`,
   `resolved_links`, `unresolved_links`, and `scope_findings`. `plan.summary`
   uses exactly `final_status=success_with_findings`, `scope_trust=degraded`,
   `page_payload_format=none`, `processed_pages=20`, `root_pages=1`,
   `tree_pages=14`, `linked_pages=5`, `other_pages=0`, `resolved_links=115`,
   `unresolved_links=39`, `scope_findings=0`, and `failed_operations=0`.
   `plan.manifest` uses exactly
   `header=page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count`
   and `line_count=21`. `plan.resolved_links` is exactly this ordered JSON
   array:
   `[{"source":"root_page","link_kind":"child_result","raw_link_value":"child_page","target":"child_page","target_space_key":"CX","target_title":"CX Child"},{"source":"root_page","link_kind":"content_id","raw_link_value":"linked_page","target":"linked_page","target_space_key":"CX","target_title":"CX Linked"},{"source":"root_page","link_kind":"href_page_id","raw_link_value":"linked_page","target":"linked_page","target_space_key":"CX","target_title":"CX Linked"},{"source":"root_page","link_kind":"href_space_title","raw_link_value":"space_key_present=1;space_key_bytes=3;space_key=AUX;title_bytes=15;title=AUX Cross Space","target":"cross_space_page","target_space_key":"AUX","target_title":"AUX Cross Space"},{"source":"root_page","link_kind":"macro_param","raw_link_value":"space_key_present=1;space_key_bytes=2;space_key=CX;title_bytes=9;title=CX Linked","target":"linked_page","target_space_key":"CX","target_title":"CX Linked"},{"source":"root_page","link_kind":"page_ref","raw_link_value":"space_key_present=0;space_key_bytes=0;space_key=;title_bytes=9;title=CX Linked","target":"linked_page","target_space_key":"CX","target_title":"CX Linked"},{"source":"root_page","link_kind":"ri_url_page_id","raw_link_value":"linked_page","target":"linked_page","target_space_key":"CX","target_title":"CX Linked"},{"source":"root_page","link_kind":"ri_url_space_title","raw_link_value":"space_key_present=1;space_key_bytes=3;space_key=AUX;title_bytes=15;title=AUX Cross Space","target":"cross_space_page","target_space_key":"AUX","target_title":"AUX Cross Space"},{"source":"child_page","link_kind":"child_result","raw_link_value":"grandchild_page","target":"grandchild_page","target_space_key":"CX","target_title":"CX Grandchild"}]`.
   `plan.unresolved_links` is exactly `[]`, and `plan.scope_findings` is
   exactly `[]`.
4. The `export` object uses exactly the keys `summary`, `manifest`,
   `payload_files`, and `attachment_files`. `export.summary` uses exactly
   `final_status=success_with_findings`, `scope_trust=degraded`,
   `page_payload_format=md`, `processed_pages=20`, `root_pages=1`,
   `tree_pages=14`, `linked_pages=5`, `other_pages=0`, `resolved_links=115`,
   `unresolved_links=39`, `scope_findings=0`, and `failed_operations=0`.
   `export.manifest` uses exactly
   `header=page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count`
   and `line_count=21`. `export.payload_files` is exactly
   `{"root_page":"page.md","child_page":"page.md","grandchild_page":"page.md","linked_page":"page.md","cross_space_page":"page.md"}`.
   `export.attachment_files` is exactly `{"root_page":"root-note.txt"}`.
5. The `export_html` object uses exactly the keys `summary`, `manifest`,
   `payload_files`, `forbidden_payload_files`, and `attachment_files`.
   `export_html.summary` uses exactly
   `final_status=success_with_findings`, `scope_trust=degraded`,
   `page_payload_format=html`, `processed_pages=20`, `root_pages=1`,
   `tree_pages=14`, `linked_pages=5`, `other_pages=0`, `resolved_links=115`,
   `unresolved_links=39`, `scope_findings=0`, and `failed_operations=0`.
   `export_html.manifest` uses exactly
   `header=page_id\tspace_key\tpage_title\tfolder\tdiscovery_source\trun_mode\tattachment_count`
   and `line_count=21`. `export_html.payload_files` is exactly
   `{"root_page":"page.html","child_page":"page.html","grandchild_page":"page.html","linked_page":"page.html","cross_space_page":"page.html"}`.
   `export_html.forbidden_payload_files` is exactly
   `{"root_page":"page.md","child_page":"page.md","grandchild_page":"page.md","linked_page":"page.md","cross_space_page":"page.md"}`.
   `export_html.attachment_files` is exactly
   `{"root_page":"root-note.txt"}`.

**Dependencies**:
- `FR-0075`
- `FR-0079`
- `FR-0080`
- `FR-0086`
- `FR-0087`
- `FR-0088`
- `FR-0090`
- `FR-0092`
- `FR-0118`
- `FR-0113`
- `FR-0114`
- `FR-0115`
- `FR-0116`
- `FR-0117`
- `FR-0119`
- `FR-0140`
- `FR-0121`
- `FR-0120`
- `FR-0176`
- `FR-0205`
- `FR-0178`
- `FR-0179`

**Traceability**:
- Area: run lifecycle
- Observable evidence: governed export-case expected outcomes

### FR-0179
**Requirement**: The expected page-payload byte artifact contract shall retain
the canonical payload bytes for the live-regression oracle pages.

**Applicability**:
- accepted non-help `confluex selftest` invocations whose expected-data
  preparation is attempted

**Rationale**:
- Live regression assertions need stable payload-byte comparisons for the pages
  that are actually checked in markdown and HTML modes.

**Acceptance Criteria**:
1. Expected page-payload byte artifacts are prepared only for the logical
   page-and-format combinations whose suite-root-relative source payload paths
   and retained expected payload paths are enumerated in criterion 2. For each
   enumerated combination, expected-data preparation copies the corresponding
   source payload file byte-for-byte to the retained expected payload path.
   This preparation does not invoke the Confluex CLI and does not read any
   payload artifact previously produced by the product.
2. Expected page-payload byte artifacts use exactly these source-to-retained
   path mappings:
   `fixtures/confluence-7137/expected/payloads/md/root_page.page.md` ->
   `expected/payloads/md/root_page.page.md`,
   `fixtures/confluence-7137/expected/payloads/md/child_page.page.md` ->
   `expected/payloads/md/child_page.page.md`,
   `fixtures/confluence-7137/expected/payloads/md/grandchild_page.page.md` ->
   `expected/payloads/md/grandchild_page.page.md`,
   `fixtures/confluence-7137/expected/payloads/md/linked_page.page.md` ->
   `expected/payloads/md/linked_page.page.md`,
   `fixtures/confluence-7137/expected/payloads/md/linked_scope_linked_page.page.md`
   -> `expected/payloads/md/linked_scope_linked_page.page.md`,
   `fixtures/confluence-7137/expected/payloads/md/linked_scope_root.page.md` ->
   `expected/payloads/md/linked_scope_root.page.md`,
   `fixtures/confluence-7137/expected/payloads/md/cross_space_page.page.md` ->
   `expected/payloads/md/cross_space_page.page.md`,
   `fixtures/confluence-7137/expected/payloads/md/markdown_page.page.md` ->
   `expected/payloads/md/markdown_page.page.md`,
   `fixtures/confluence-7137/expected/payloads/md/download_limit_root_page.page.md`
   -> `expected/payloads/md/download_limit_root_page.page.md`,
   `fixtures/confluence-7137/expected/payloads/html/root_page.page.html` ->
   `expected/payloads/html/root_page.page.html`,
   `fixtures/confluence-7137/expected/payloads/html/child_page.page.html` ->
   `expected/payloads/html/child_page.page.html`,
   `fixtures/confluence-7137/expected/payloads/html/grandchild_page.page.html`
   -> `expected/payloads/html/grandchild_page.page.html`,
   `fixtures/confluence-7137/expected/payloads/html/linked_page.page.html` ->
   `expected/payloads/html/linked_page.page.html`, and
   `fixtures/confluence-7137/expected/payloads/html/cross_space_page.page.html`
   -> `expected/payloads/html/cross_space_page.page.html`. No expected payload
   artifact is retained for any other logical page or payload-format
   combination from `FR-0176`, because only the combinations listed above are
   subject to direct payload-byte comparison by the governed live-regression
   cases.
3. Each source payload file named in criterion 2 and each retained expected
   page-payload byte artifact from criterion 2 is non-empty UTF-8 text.
4. When expected-data preparation passes, the `expected/payloads/` directory
   contains exactly `md/` and `html/`.
5. When expected-data preparation passes, `expected/payloads/md/` contains
   exactly the `.page.md` files listed under `expected/payloads/md/` in
   criterion 2, and `expected/payloads/html/` contains exactly the
   `.page.html` files listed under `expected/payloads/html/` in criterion 2.
6. No recursive entry exists under `expected/` other than
   `expected/live-commands.json`,
   `expected/live-command-expectations.json`,
   `expected/comparison-rules.json`, and the `expected/payloads/` tree together
   with the payload directories and files required by criteria 2 and 4 through
   5.
7. Each suite-root-relative source payload path and each report-root-relative
   retained payload path in criterion 2 is serialized as a governed relative
   path under `FR-0150`.
8. Each `.page.md` source payload file and retained `.page.md` expected payload
   artifact from criterion 2 is the complete normalized Markdown page
   representation governed by `FR-0074` for its corresponding logical fixture
   page, including any localized relative `page.md` links for exported internal
   page targets, preserved local `attachments/...` paths, inline unresolved
   markers for source-page unresolved internal page targets, and unchanged
   external URLs, fenced code literals, and inline code literals when those
   forms are present; it is not Confluence storage-format XML.

**Dependencies**:
- `FR-0074`
- `FR-0138`
- `FR-0150`
- `FR-0173`
- `FR-0176`

**Traceability**:
- Area: run lifecycle
- Observable evidence: expected payload bytes and payload directory layout
