# Configuration Requirements


### FR-0045
**Requirement**: Public configuration keys shall use one closed environment
variable inventory.

**Applicability**:
- env-file parsing
- process-environment configuration reads
- configuration diagnostics and validation

**Rationale**:
- Operators need one authoritative list of supported public configuration
  inputs.

**Acceptance Criteria**:
1. The public configuration keys are exactly
   `CONFLUEX_CONFLUENCE_BASE_URL`, `CONFLUEX_CONFLUENCE_TOKEN`,
   `CONFLUEX_OUTPUT_ROOT`, `CONFLUEX_LOG_FILE`, `CONFLUEX_MAX_PAGES`,
   `CONFLUEX_MAX_DOWNLOAD_MIB`, `CONFLUEX_SLEEP_MS`,
   `CONFLUEX_MAX_FIND_CANDIDATES`, and `CONFLUEX_LINK_DEPTH`.
2. Everywhere the public configuration key inventory is serialized as an
   ordered list, the order is exactly the order in criterion 1.
3. `CONFLUEX_CONFLUENCE_BASE_URL` supplies the Confluence base URL consumed by
   the remote-access context in `FR-0216`.
4. `CONFLUEX_CONFLUENCE_TOKEN` supplies the Bearer token consumed by the
   remote-access context in `FR-0216`.
5. `CONFLUEX_OUTPUT_ROOT` supplies the output-root selector consumed by
   `FR-0021`.
6. `CONFLUEX_LOG_FILE` supplies the log-file selector consumed by `FR-0029`.
7. `CONFLUEX_MAX_PAGES`, `CONFLUEX_MAX_DOWNLOAD_MIB`, `CONFLUEX_SLEEP_MS`,
   `CONFLUEX_MAX_FIND_CANDIDATES`, and `CONFLUEX_LINK_DEPTH` supply the numeric
   run-control selectors consumed by `FR-0025`.

**Dependencies**:
- `FR-0021`
- `FR-0025`
- `FR-0029`
- `FR-0216`

**Traceability**:
- Area: configuration
- Observable evidence: env-file keys, process-environment reads, effective
  option values

### FR-0046
**Requirement**: Public Confluence credentials shall use token-only Bearer
authentication.

**Applicability**:
- non-help `export` invocations
- non-help `plan` invocations
- non-help `doctor --page-id <id>` invocations

**Rationale**:
- Operators need one credential model that is compatible across public
  workflows and safe to reason about in diagnostics.

**Acceptance Criteria**:
1. The only public credential input is `CONFLUEX_CONFLUENCE_TOKEN`.
2. The product uses the selected token only as the Bearer token value governed
   by `FR-0216`.
3. The selected token value is not case-normalized, percent-decoded,
   percent-encoded, URL encoded, trimmed, split, or otherwise transformed before
   it is placed in the Authorization field governed by `FR-0216`.
4. Secret-output redaction for the selected token is governed by `FR-0047`.

**Dependencies**:
- `FR-0047`
- `FR-0216`

**Traceability**:
- Area: configuration
- Observable evidence: outbound Authorization field and diagnostics without
  token disclosure

### FR-0216
**Requirement**: Supported remote Confluence access shall use one token-only
invocation-local access context.

**Applicability**:
- non-help `export` and `plan` invocations
- non-help `doctor` invocations with `--page-id <id>`

**Rationale**:
- Operators and tests need one authoritative source for the base URL and token
  used by each invocation.

**Acceptance Criteria**:
1. For this card, the remote-access context is the pair `(base_url, token)` used
   to resolve root pages and acquire Confluence page or attachment data for the
   current invocation.
2. The remote-access context uses the effective
   `CONFLUEX_CONFLUENCE_BASE_URL` value as `base_url` and the effective
   `CONFLUEX_CONFLUENCE_TOKEN` value as `token`.
3. Effective values are selected under `FR-0219`.
4. `base_url` and `token` are each non-empty and contain no TAB, LF, or CR.
5. The product sends exactly one HTTP Authorization field for authenticated
   Confluence requests, with the exact field value `Bearer <token>`, where
   `<token>` is the selected token value from criterion 2 with no case
   normalization, percent-decoding, percent-encoding, URL encoding, trimming, or
   splitting.
6. `base_url` is usable only when it is an absolute `http://` or `https://` URL
   containing no userinfo component, query component, or fragment component, and
   whose path component is either empty, exactly `/`, or a slash-prefixed path
   whose final character is not `/`. For this card, exact forms with empty path
   and with path `/` are semantically equivalent root-path `base_url` values;
   any other usable `base_url` preserves its exact path prefix and does not add
   or remove a trailing slash.
7. For this card, a governed Confluence request target is the absolute-path and
   optional-query reference required by one governed root-page preflight,
   `doctor --page-id`, page acquisition, or attachment acquisition step before
   any `base_url` path prefix from criterion 6 is applied. Its path component
   `<target_path>` begins with `/`; it contains no scheme, authority, or
   fragment; and its optional query component `<target_query>` is either absent
   or is the exact query string bytes after `?`.
8. If `base_url` from criterion 6 is a root-path `base_url`, the effective
   request URL used for any governed access step has path exactly
   `<target_path>` from criterion 7 and has query component absent when
   `<target_query>` is absent or exactly equal to `<target_query>` when it is
   present.
9. If `base_url` from criterion 6 has a non-root preserved path prefix
   `<prefix>`, the effective request URL used for any governed access step has
   path exactly `<prefix><target_path>` and has query component absent when
   `<target_query>` is absent or exactly equal to `<target_query>` when it is
   present. The product does not strip, duplicate, normalize, or insert any
   additional path segment or slash between `<prefix>` and `<target_path>`, and
   does not rewrite `<target_query>`.
10. Every governed root-page preflight, `doctor --page-id`, page acquisition,
    and attachment acquisition step uses the effective request URL from
    criteria 7 through 9 together with the exact Bearer token Authorization
    field from criterion 5 and no alternative base URL or credential source.
11. The product uses one remote-access context consistently for root-page
    preflight, `doctor --page-id`, and every later page or attachment
    acquisition step attempted by that same invocation.
12. A remote-access context is usable for the current invocation only when the
    active values satisfy every applicable requirement from criteria 4 through
    10 for that invocation.
13. If a governed operation cannot use one usable context, the governing card
    for that operation takes its defined failure route.

**Dependencies**:
- `FR-0219`

**Traceability**:
- Area: configuration
- Observable evidence: consistent page-access behavior and Bearer
  Authorization under one invocation

### FR-0219
**Requirement**: Confluex shall select and parse one env-file source before
reading effective public configuration.

**Applicability**:
- non-help `export`, `plan`, and `doctor` invocations before invocation
  acceptance under `FR-0212`
- effective public configuration selection

**Rationale**:
- Operators need reproducible configuration without relying only on shell
  profile state, and secrets loaded from files must have deterministic
  precedence.

**Acceptance Criteria**:
1. If `--env-file <file>` is supplied, the selected env file is exactly the
   normalized path produced from `<file>` under `FR-0158` and `FR-0159`;
   `./.confluex.env` is not read for that invocation.
2. If `--env-file <file>` is supplied and path normalization under criterion 1
   fails, the invocation is rejected under `FR-0019` before command work begins.
3. If `--env-file <file>` is absent and `./.confluex.env` exists in the current
   working directory as a regular file, that file is the selected env file.
4. If `--env-file <file>` is absent and `./.confluex.env` is absent or exists
   but is not a regular file, no env file is selected.
5. When no env file is selected, the env-file source contributes no key-value
   pairs to effective public configuration selection.
6. If a selected env file cannot be read as a regular UTF-8 text file, the
   invocation is rejected under `FR-0019` before command work begins.
7. A selected env file is split into logical lines at LF. If the file does not
   end with LF, the final byte sequence after the last LF is one logical line.
   For each logical line, one trailing CR is removed when present before line
   classification or key-value parsing.
8. An env-file line is ignored when the line is empty after removing leading and
   trailing ASCII space and TAB, or when the first code point after removing
   leading ASCII space and TAB is `#`.
9. A non-ignored env-file line is malformed unless it contains `KEY=value`.
   `KEY` is the text before the first `=` after removing leading and trailing
   ASCII space and TAB; it must be non-empty and contain no ASCII space, TAB,
   `=`, NUL, LF, or CR. The value is the text after the first `=`, except that
   one surrounding double-quote pair is removed when both the first and final
   value code points are `"`.
10. If any non-ignored env-file line is malformed under criterion 9, the
   invocation is rejected under `FR-0019` before command work begins.
11. If the same key appears on more than one non-ignored env-file line, the
    selected env-file value for that key is the value from the last parsed line
    with that key.
12. Only keys from the public configuration key inventory governed by `FR-0045`
    participate in effective public configuration selection.
13. Effective configuration precedence is exactly command-line option value,
    then selected env-file value, then process environment value, then no value.
14. Command-line option precedence applies to these selector pairs:
   `--out <path>` over `CONFLUEX_OUTPUT_ROOT`, `--log-file <file>` over
   `CONFLUEX_LOG_FILE`, `--max-pages <n>` over `CONFLUEX_MAX_PAGES`,
   `--max-download-mib <n>` over `CONFLUEX_MAX_DOWNLOAD_MIB`,
   `--sleep-ms <n>` over `CONFLUEX_SLEEP_MS`,
   `--max-find-candidates <n>` over `CONFLUEX_MAX_FIND_CANDIDATES`, and
   `--link-depth <n>` over `CONFLUEX_LINK_DEPTH`.
15. `CONFLUEX_CONFLUENCE_BASE_URL` and `CONFLUEX_CONFLUENCE_TOKEN` have no
    command-line option aliases in the public CLI.
16. Env-file values never supply hidden fallbacks for unsupported options or
    unsupported commands.
17. Secret effective values, including `CONFLUEX_CONFLUENCE_TOKEN`, are never
    emitted to stdout, stderr, logs, reports, or diagnostic fields.

**Dependencies**:
- `FR-0019`
- `FR-0036`
- `FR-0045`
- `FR-0158`
- `FR-0159`
- `FR-0212`

**Traceability**:
- Area: configuration
- Observable evidence: selected env-file reads, effective option selection,
  rejection timing, secret redaction

### FR-0047
**Requirement**: Public output channels shall redact secret configuration
values.

**Applicability**:
- stdout
- stderr
- persistent log artifacts
- retained report artifacts
- diagnostic fields

**Rationale**:
- Operators need tokens loaded from env files or process environments to remain
  out of public CLI output.

**Acceptance Criteria**:
1. `CONFLUEX_CONFLUENCE_TOKEN` values are classified as secret values.
2. Secret values are never emitted verbatim to stdout.
3. Secret values are never emitted verbatim to stderr.
4. Secret values are never emitted verbatim to persistent log artifacts.
5. Secret values are never emitted verbatim to retained report artifacts.
6. Secret values are never emitted verbatim to diagnostic fields.
7. When a diagnostic must identify a token-related failure, it uses a stable
   reason token governed by the diagnostic or preflight card that owns that
   failure branch.

**Dependencies**:
- `FR-0039`
- `FR-0134`
- `FR-0216`

**Traceability**:
- Area: configuration
- Observable evidence: CLI output, logs, and reports without token disclosure
