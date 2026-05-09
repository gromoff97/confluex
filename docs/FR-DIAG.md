# Diagnostics Requirements


### FR-0038
**Requirement**: Setup shall verify required local dependency readiness before
persisting user configuration.

**Applicability**:
- accepted non-help `setup` invocations

**Rationale**:
- Operators need setup to save configuration only when the local runtime can run
  Confluex and invoke the Markdown converter.

**Acceptance Criteria**:
1. Setup checks exactly these local dependencies before writing user config:
   the currently running Node.js runtime and the `uvx` executable.
2. The supported Node.js runtime threshold is exactly `>=20.11.0`.
3. Node.js runtime comparison parses the current `process.versions.node` value
   as dot-delimited decimal `major.minor.patch` components and accepts versions
   greater than or equal to `20.11.0`.
4. The exact dependency executable name is `uvx` for the Markdown converter.
5. `uvx` is resolved on `PATH`.
6. Dependency probes receive only the subprocess environment keys allowed by
   `FR-0253`.
7. On Windows, `uvx` resolution honors executable candidates compatible with
   `PATHEXT`, including command shims such as `uvx.cmd`.
8. If the Node.js runtime is unsupported, setup fails before writing user config
   with stderr exactly `ERROR: setup_failed unsupported_node_runtime`.
9. If `uvx` cannot be resolved on `PATH`, setup fails before writing user
   config with stderr exactly `ERROR: setup_failed missing_markdown_converter`.
10. Local dependency failure output never emits token values, Authorization
   header values, cookies, full response bodies, or full process environments.

**Dependencies**:
- `FR-0237`
- `FR-0253`

**Traceability**:
- Area: diagnostics
- Observable evidence: setup failure stderr and no user config write

### FR-0039
**Requirement**: Export shall validate root page access before creating an
output root.

**Applicability**:
- accepted non-help `export` invocations

**Rationale**:
- Operators need page-id mistakes and access failures to fail before filesystem
  side effects.

**Acceptance Criteria**:
1. Before creating an output root, `export` uses the remote-access
   context from `FR-0216` to resolve the supplied `--page-id <id>` value to one
   canonical page identity.
2. Root page access succeeds only when the remote-access context is usable, the
   target page is not missing, the target page is not inaccessible, and the
   response resolves to one canonical page identity.
3. If root page access fails, the invocation exits `1`, writes no stdout, and
   writes the root-page validation rejection diagnostic governed by `FR-0146`.
4. If root page access fails, the product creates no output root selected by
   `--out`, JSON config key `outputRoot`, or generated output-root selection.
5. Page-access failure output never emits token values, Authorization header
   values, cookies, full response bodies, or full process environments.

**Dependencies**:
- `FR-0017`
- `FR-0020`
- `FR-0014`
- `FR-0146`
- `FR-0216`
- `FR-0237`

**Traceability**:
- Area: diagnostics
- Observable evidence: pre-output-root page-access failure

### FR-0234
**Requirement**: Setup shall verify Confluence connection configuration before
persisting user configuration.

**Applicability**:
- accepted non-help `setup` invocations

**Rationale**:
- Operators need setup to save only a syntactically usable base URL and a token
  that authenticates to Confluence.

**Acceptance Criteria**:
1. Setup validates the entered base URL using the remote-access base-URL syntax
   governed by `FR-0216`.
2. Setup validates the entered token using the remote-access token syntax
   governed by `FR-0216`.
3. Setup performs an authenticated current-user request using the entered base
   URL and token before writing user config.
4. Setup success requires the current-user response to complete with HTTP `200`
   and a JSON object whose `type` field is exactly `known`.
5. If base URL syntax validation fails, setup fails before writing user config
   with stderr exactly `ERROR: setup_failed invalid_base_url`.
6. If token syntax validation fails or the entered token is empty, setup fails
   before writing user config with stderr exactly
   `ERROR: setup_failed missing_token`.
7. HTTP status `401`, HTTP status `403`, or a current-user JSON object whose
   `type` field is not exactly `known` fails setup before writing user config
   with stderr exactly `ERROR: setup_failed auth_rejected`.
8. HTTP status `404`, HTTP status `410`, or any other completed non-`200`
   current-user response fails setup before writing user config with stderr
   exactly `ERROR: setup_failed page_inaccessible`.
9. DNS name-resolution failure fails setup before writing user config with
   stderr exactly `ERROR: setup_failed transport_dns`.
10. TLS handshake, certificate validation, or protocol-version failure fails
    setup before writing user config with stderr exactly
    `ERROR: setup_failed transport_tls`.
11. Connect, read, write, or response timeout fails setup before writing user
    config with stderr exactly `ERROR: setup_failed transport_timeout`.
12. Connection reset by peer or premature connection close fails setup before
    writing user config with stderr exactly
    `ERROR: setup_failed transport_connection_reset`.
13. Proxy connection, proxy authentication, or proxy response failure fails setup
    before writing user config with stderr exactly
    `ERROR: setup_failed transport_proxy`.
14. Setup connection validation output never emits token values, Authorization
    header values, cookies, full response bodies, or full process environments.

**Dependencies**:
- `FR-0216`
- `FR-0237`

**Traceability**:
- Area: diagnostics
- Observable evidence: setup connection failure stderr and no user config write

### FR-0041
**Requirement**: Setup shall collect Confluence connection values interactively.

**Applicability**:
- accepted non-help `setup` invocations

**Rationale**:
- Operators need first-run setup without exposing the token in terminal output.

**Acceptance Criteria**:
1. Setup prompts for the Confluence base URL before prompting for the token.
2. The base URL prompt is written to stdout and accepts normal terminal input.
3. The token prompt is written to stdout and accepts terminal input with echo
   disabled.
4. Bytes entered for the token are never written to stdout.
5. Bytes entered for the token are never written to stderr.
6. If setup is running interactively and echo suppression is unavailable, setup
   fails before accepting token bytes and before writing user config.
7. Setup accepts no command-line option that supplies the base URL or token.

**Dependencies**:
- `FR-0237`
- `FR-0222`

**Traceability**:
- Area: diagnostics
- Observable evidence: setup terminal interaction

### FR-0042
**Requirement**: Setup shall persist user configuration only after all setup
validation passes.

**Applicability**:
- accepted non-help `setup` invocations

**Rationale**:
- Operators need failed setup attempts to avoid writing unusable or rejected
  tokens to disk.

**Acceptance Criteria**:
1. Setup writes user config only after `FR-0038`, `FR-0234`, and `FR-0041`
   criteria pass.
2. Setup writes user config using the path and JSON shape governed by `FR-0246`.
3. Setup creates missing parent directories for the user config path.
4. Setup writes the user config file with owner-readable and owner-writable
   permissions when the platform supports POSIX file modes.
5. If any setup validation fails, setup does not create, replace, or truncate
   the user config file.

**Dependencies**:
- `FR-0038`
- `FR-0234`
- `FR-0041`
- `FR-0246`

**Traceability**:
- Area: diagnostics
- Observable evidence: setup-written user config or absent write on failure

### FR-0043
**Requirement**: Accepted setup invocations shall use one closed result-line
contract.

**Applicability**:
- accepted non-help `setup` invocations

**Rationale**:
- Operators and automation need deterministic setup success and failure
  serialization.

**Acceptance Criteria**:
1. On setup success, setup writes exactly two LF-terminated result lines in this
   order: `setup_result=passed`, then `config_path=<absolute_path>`.
2. In `config_path=<absolute_path>`, `<absolute_path>` is the absolute user
   config path governed by `FR-0246`.
3. On setup success, stderr is empty and exit code is `0`.
4. On setup failure, setup writes no `setup_result=passed` or `config_path=`
   stdout result line.
5. On setup failure, stderr contains exactly one LF-terminated result line:
   `ERROR: setup_failed <reason>`.
6. On setup failure, `<reason>` is exactly one of
   `unsupported_node_runtime`, `missing_markdown_converter`,
   `invalid_base_url`, `missing_token`, `auth_rejected`,
   `page_inaccessible`, `transport_dns`, `transport_tls`,
   `transport_timeout`, `transport_connection_reset`, `transport_proxy`, or
   `hidden_input_unavailable`.
7. On setup failure, exit code is `1`.

**Dependencies**:
- `FR-0038`
- `FR-0234`
- `FR-0042`
- `FR-0246`

**Traceability**:
- Area: diagnostics
- Observable evidence: setup stdout, stderr, and exit code

### FR-0044
**Requirement**: Setup shall not perform page-specific access validation.

**Applicability**:
- accepted non-help `setup` invocations

**Rationale**:
- Setup validates reusable connection configuration; page-specific access is
  owned by `export`.

**Acceptance Criteria**:
1. Setup does not prompt for a Confluence page id.
2. Setup does not accept `--page-id <id>`.
3. Setup does not request `/rest/api/content/<page_id>` for any page id.
4. Page-specific preflight remains governed by `FR-0039`.

**Dependencies**:
- `FR-0039`
- `FR-0036`

**Traceability**:
- Area: diagnostics
- Observable evidence: setup command surface and Confluence request targets
