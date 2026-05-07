# Diagnostics Requirements


### FR-0038
**Requirement**: `doctor` shall report environment readiness for required local
dependencies.

**Applicability**:
- accepted non-help `doctor` invocations that do not fail under `FR-0142`

**Rationale**:
- Operators need a deterministic readiness report for the local executables that
  gate public CLI execution and Markdown conversion.

**Acceptance Criteria**:
1. `doctor` checks exactly these environment-readiness dependencies:
   `node_runtime` for the currently running Node.js process and
   `markdown_converter` for the `uvx` executable required to invoke the
   external Markdown converter.
2. `doctor` emits exactly one stdout line for each dependency in the format
   `dependency_<label>=<state>`.
3. Dependency lines appear in this exact order:
   `dependency_node_runtime=...`,
   `dependency_markdown_converter=...`.
4. `<state>` uses only `absent`, `present:unknown_version`,
   `present:<version_text>`, or `unsupported:<version_text>`.
5. The supported Node.js runtime threshold is exactly `>=20.11.0`.
6. `node_runtime` is read from the current Node.js process version string
   `process.version`; it is not resolved on `PATH`.
7. For `node_runtime`, `<version_text>` is `process.version` after removing
   leading and trailing ASCII space, TAB, LF, and CR.
8. For `node_runtime`, semantic-version comparison removes one leading `v` from
   `<version_text>` when present and then parses exactly three dot-separated
   non-negative base-10 integer components: major, minor, and patch.
9. `dependency_node_runtime=present:unknown_version` when criterion 7 yields an
   empty string, when `<version_text>` is exactly `unknown_version`, when
   `<version_text>` contains any ASCII control character with code point
   `0x00` through `0x1F` or `0x7F`, or when semantic-version parsing under
   criterion 8 fails.
10. `dependency_node_runtime=unsupported:<version_text>` when semantic-version
    parsing under criterion 8 succeeds and the parsed version is lower than
    `20.11.0`.
11. `dependency_node_runtime=present:<version_text>` when semantic-version
    parsing under criterion 8 succeeds and the parsed version is greater than
    or equal to `20.11.0`.
12. The exact dependency executable name is `uvx` for `markdown_converter`.
13. The `markdown_converter` check is executed through the packaged Markdown
    payload module that owns converter invocation under `FR-0074`; if that
    module cannot load after invocation acceptance, the `doctor` invocation
    fails under `FR-0142`.
14. `dependency_markdown_converter=absent` when `uvx` cannot be resolved to an
    executable on `PATH`.
15. When `uvx` is present, the version probe is `uvx --version`.
16. `dependency_markdown_converter=present:unknown_version` when the version
    probe exits non-zero, when its stdout bytes are not valid UTF-8, when its
    UTF-8 stdout contains no non-empty line after removing leading and trailing
    ASCII space, TAB, LF, and CR, when the first such non-empty line contains
    any ASCII control character with code point `0x00` through `0x1F` or
    `0x7F`, or when the first such non-empty line after removing leading and
    trailing ASCII space, TAB, LF, and CR is exactly `unknown_version`.
17. `dependency_markdown_converter=present:<version_text>` when the version
    probe exits `0`, its stdout bytes are valid UTF-8, and the decoded stdout
    contains at least one non-empty line after removing leading and trailing
    ASCII space, TAB, LF, and CR, and the first such non-empty line contains no
    ASCII control character with code point `0x00` through `0x1F` or `0x7F` and
    is not exactly `unknown_version`.
18. For `dependency_markdown_converter=present:<version_text>`,
    `<version_text>` is the first non-empty stdout line from criterion 17 after
    removing leading and trailing ASCII space, TAB, LF, and CR; stderr from the
    version probe is ignored.
19. The serialized `<version_text>` contains no ASCII control character with code
    point `0x00` through `0x1F` or `0x7F` and does not begin or end with an
    ASCII space.
20. ASCII space inside `<version_text>` is part of `<version_text>` and does not
    delimit additional fields.

**Dependencies**:
- `FR-0074`
- `FR-0142`

**Traceability**:
- Area: diagnostics
- Observable evidence: `doctor` stdout dependency lines

### FR-0039
**Requirement**: `doctor` shall support optional page-access diagnostics.

**Applicability**:
- accepted non-help `doctor` invocations that do not fail under `FR-0142`

**Rationale**:
- Operators need a deterministic way to confirm whether a candidate root page is
  accessible before planning or exporting.

**Acceptance Criteria**:
1. `doctor` without `--page-id` emits the stdout line
   `page_access=skipped` exactly once.
2. `doctor --page-id <id>` uses the remote-access context from `FR-0216`,
   resolves the supplied page-id input to one canonical page identity, and
   treats page access as successful only when that context is usable for the
   current invocation and the target page is not missing, is not inaccessible,
   and can be resolved to a page identity, matching the root-page preflight
   success condition in `FR-0017`; otherwise page access fails.
3. `doctor --page-id <id>` emits the stdout line `page_access=ok` exactly once
   when the predicate from criterion 2 succeeds.
4. `doctor --page-id <id>` emits the stdout line `page_access=failed` exactly
   once when the predicate from criterion 2 fails.
5. `doctor --page-id <id>` emits the stdout line
   `page_identity=<page_id>` only when page access succeeds.
6. In `page_identity=<page_id>`, `<page_id>` uses the canonical
   page-identifier syntax required by `FR-0014` and reports the resolved page
   identifier rather than merely echoing the raw command-line token.
7. `doctor --page-id <id>` emits exactly one stdout line
   `page_access_reason=<reason>` after the `page_access` line. When
   `page_access=ok`, `<reason>` is `none`. When `page_access=failed`,
   `<reason>` is exactly one of `missing_base_url`, `missing_token`,
   `invalid_base_url`, `auth_rejected`, `page_inaccessible`, `transport_tls`,
   `transport_dns`, `transport_timeout`, `transport_connection_reset`,
   `transport_proxy`.
8. When `page_access=failed`, `<reason>` is selected from the failure conditions
   observed while evaluating criterion 2 using this precedence order:
   missing base URL, missing token, invalid base URL, authentication rejection,
   page inaccessible or non-OK HTTP response, DNS transport failure, TLS
   transport failure, timeout transport failure, connection-reset transport
   failure, proxy transport failure, then page identity resolution failure.
9. Missing base URL selects `missing_base_url`.
10. Missing token selects `missing_token`.
11. Invalid base URL selects `invalid_base_url`.
12. HTTP status `401` or `403`, or a completed current-user identity probe
    whose JSON object does not contain `type` equal to `known`, selects
    `auth_rejected`.
13. HTTP status `404`, HTTP status `410`, or any other completed HTTP response
    whose status is not `200` selects `page_inaccessible`.
14. DNS name-resolution failure selects `transport_dns`.
15. TLS handshake, certificate validation, or protocol-version failure selects
    `transport_tls`.
16. Connect, read, write, or response timeout selects `transport_timeout`.
17. Connection reset by peer or premature connection close selects
    `transport_connection_reset`.
18. Proxy connection, proxy authentication, or proxy response failure selects
    `transport_proxy`.
19. A completed HTTP `200` response that cannot be resolved to the canonical page
    identity required by criterion 2 selects `page_inaccessible`.
20. Page-access diagnostics never include token values, Authorization header
    values, cookies, full response bodies, or full process environments.

**Dependencies**:
- `FR-0020`
- `FR-0014`
- `FR-0017`
- `FR-0216`
- `FR-0142`

**Traceability**:
- Area: diagnostics
- Observable evidence: `page_access` and `page_identity` lines

### FR-0234
**Requirement**: `doctor` shall report public Confluence configuration
readiness.

**Applicability**:
- accepted non-help `doctor` invocations that do not fail under `FR-0142`

**Rationale**:
- Operators need to know whether the env/env-file Confluence configuration can
  support page access before planning or exporting.

**Acceptance Criteria**:
1. `doctor` emits the stdout line `configuration=<state>` exactly once.
2. `<state>` uses only `ok`, `missing_base_url`, `missing_token`, or
   `invalid_base_url`.
3. `configuration=missing_base_url` when no effective
   `CONFLUEX_CONFLUENCE_BASE_URL` value is selected under `FR-0219`.
4. `configuration=missing_token` when criterion 3 does not apply and either no
   effective `CONFLUEX_CONFLUENCE_TOKEN` value is selected under `FR-0219` or
   the selected value is empty or contains TAB, LF, or CR.
5. `configuration=invalid_base_url` when criteria 3 and 4 do not apply and the
   selected `CONFLUEX_CONFLUENCE_BASE_URL` value fails the base-URL syntax
   required by `FR-0216`.
6. `configuration=ok` when criteria 3 through 5 do not apply and the selected
   remote-access context satisfies `FR-0216` criteria 4 through 6.
7. Configuration diagnostics never emit token values.

**Dependencies**:
- `FR-0237`
- `FR-0142`
- `FR-0216`
- `FR-0219`

**Traceability**:
- Area: diagnostics
- Observable evidence: `configuration` line

### FR-0041
**Requirement**: `doctor` shall report the active support profile.

**Applicability**:
- accepted non-help `doctor` invocations that do not fail under `FR-0142`

**Rationale**:
- Operators need to know what internal-link profile the product claims to
  support.

**Acceptance Criteria**:
1. `doctor` emits the stdout line `support_profile=<support_profile>` exactly
   once.
2. `<support_profile>` uses the support-profile value contract governed by
   `FR-0119`.
3. The `support_profile` token emitted by `doctor` matches the
   `support_profile` token used by `summary.txt` in `export` and `plan` report
   sets.

**Dependencies**:
- `FR-0090`
- `FR-0119`
- `FR-0142`

**Traceability**:
- Area: diagnostics
- Observable evidence: `support_profile` line

### FR-0042
**Requirement**: `doctor` shall expose machine-readable next-step guidance.

**Applicability**:
- accepted non-help `doctor` invocations that do not fail under `FR-0142`

**Rationale**:
- Operators need a machine-readable summary of what to fix next.

**Acceptance Criteria**:
1. `doctor` emits the stdout line `next_action=<value>` exactly once.
2. `<value>` uses either the shared absence token defined by `FR-0125` or a
   comma-delimited list serialized with the shared token-list form defined by
   `FR-0126` and containing one or more unique tokens chosen from
   `upgrade_node_runtime`, `install_markdown_converter`,
   `set_confluence_base_url`, `set_confluence_token`,
   `fix_confluence_base_url`, and `check_page_access`.
3. `upgrade_node_runtime` appears if and only if the emitted
   `dependency_node_runtime` line begins with
   `dependency_node_runtime=unsupported:`.
4. `install_markdown_converter` appears if and only if
   `dependency_markdown_converter=absent`.
5. `set_confluence_base_url` appears if and only if
   `configuration=missing_base_url`.
6. `set_confluence_token` appears if and only if `configuration=missing_token`.
7. `fix_confluence_base_url` appears if and only if
   `configuration=invalid_base_url`.
8. `check_page_access` appears if and only if `page_access=failed`.
9. If none of the conditions in criteria 3 through 8 apply,
   `next_action=none`.
10. If `next_action` is not `none`, tokens appear only in this order:
   `upgrade_node_runtime`, `install_markdown_converter`,
   `set_confluence_base_url`, `set_confluence_token`,
   `fix_confluence_base_url`, `check_page_access`.

**Dependencies**:
- `FR-0038`
- `FR-0039`
- `FR-0234`
- `FR-0125`
- `FR-0126`
- `FR-0142`

**Traceability**:
- Area: diagnostics
- Observable evidence: `next_action` line

### FR-0043
**Requirement**: Accepted `doctor` invocations that complete shall use one closed
stdout contract.

**Applicability**:
- accepted non-help `doctor` invocations that do not fail under `FR-0142`

**Rationale**:
- Operators and automation need a deterministic, line-oriented diagnostic
  contract.

**Acceptance Criteria**:
1. The required informational lines appear on `stdout` in this exact order:
   dependency lines, `configuration`, `page_access`, optional
   `page_access_reason`, optional `page_identity`, `support_profile`,
   `supported_link_forms`, `next_action`.
2. The optional `page_access_reason` line appears exactly for
   `doctor --page-id <id>` invocations and is governed by `FR-0039`.
3. The optional `page_identity` line appears only under the successful page
   access condition governed by `FR-0039`.
4. Accepted `doctor` invocations emit no additional stdout lines.
5. Accepted `doctor` invocations write nothing to `stderr`.
6. The accepted invocation exit code is governed by `FR-0118`.
7. If an accepted `doctor` invocation fails under `FR-0142`, stdout, stderr, and
   exit code are governed by `FR-0142` instead of criteria 1 through 6.

**Dependencies**:
- `FR-0038`
- `FR-0039`
- `FR-0234`
- `FR-0041`
- `FR-0042`
- `FR-0044`
- `FR-0010`
- `FR-0118`
- `FR-0142`

**Traceability**:
- Area: diagnostics
- Observable evidence: stdout line order, empty stderr, exit code

### FR-0044
**Requirement**: `doctor` shall report the documented supported link forms.

**Applicability**:
- accepted non-help `doctor` invocations that do not fail under `FR-0142`

**Rationale**:
- Operators need an explicit machine-readable statement of which internal-link
  forms are actually supported for link-driven scope expansion.

**Acceptance Criteria**:
1. `doctor` emits the stdout line `supported_link_forms=<forms>` exactly once.
2. `<forms>` uses the delimited token-list serialization defined by `FR-0126`.
3. `<forms>` is exactly the supported discovery-form vocabulary from `FR-0063`,
   in `FR-0063` order.

**Dependencies**:
- `FR-0063`
- `FR-0126`
- `FR-0142`

**Traceability**:
- Area: diagnostics
- Observable evidence: `supported_link_forms` line
