# Configuration Requirements


### FR-0235
**Requirement**: Public configuration inputs shall use one closed key inventory.

**Applicability**:
- process-environment configuration reads
- user configuration mapping
- explicit JSON configuration mapping
- configuration validation

**Rationale**:
- Operators need one authoritative list of supported public configuration keys
  across JSON files and credential environment variables.

**Acceptance Criteria**:
1. The public JSON configuration keys are exactly `confluenceBaseUrl`,
   `confluenceToken`, `insecure`, `outputRoot`, `maxPages`, `maxDownloadMib`,
   `sleepMs`, `maxFindCandidates`, and `linkDepth`.
2. Everywhere the public JSON configuration key inventory is serialized as an
   ordered list, the order is exactly the order in criterion 1.
3. The public process-environment configuration keys are exactly
   `CONFLUEX_CONFLUENCE_BASE_URL` and `CONFLUEX_CONFLUENCE_TOKEN`, in that
   order.
4. `confluenceBaseUrl` and `CONFLUEX_CONFLUENCE_BASE_URL` supply the Confluence
   base URL consumed by the remote-access context in `FR-0216`.
5. `confluenceToken` and `CONFLUEX_CONFLUENCE_TOKEN` supply the Bearer token
   consumed by the remote-access context in `FR-0216`.
6. `insecure` supplies the insecure transport selector consumed by `FR-0251`.
7. `outputRoot` supplies the output-root selector consumed by `FR-0021`.
8. `maxPages`, `maxDownloadMib`, `sleepMs`, `maxFindCandidates`, and
   `linkDepth` supply the run-control selectors consumed by `FR-0228`.

**Dependencies**:
- `FR-0021`
- `FR-0228`
- `FR-0216`
- `FR-0251`

**Traceability**:
- Area: configuration
- Observable evidence: JSON config keys, process-environment credential reads,
  user config mapping, explicit config mapping, effective option values

### FR-0236
**Requirement**: Public Confluence credentials shall use token-only Bearer
authentication.

**Applicability**:
- non-help `setup` invocations
- non-help `export` invocations

**Rationale**:
- Operators need one credential model that is compatible across public
  workflows and safe to reason about in diagnostics.

**Acceptance Criteria**:
1. Public Confluence authentication uses only the token value selected under
   `FR-0219` or entered during setup under `FR-0216`.
2. The product uses the selected token only as the Bearer token value governed
   by `FR-0216`.
3. The selected token value is not case-normalized, percent-decoded,
   percent-encoded, URL encoded, trimmed, split, or otherwise transformed before
   it is placed in the Authorization field governed by `FR-0216`.
4. Secret-output redaction for the selected token is governed by `FR-0237`.

**Dependencies**:
- `FR-0237`
- `FR-0216`
- `FR-0219`

**Traceability**:
- Area: configuration
- Observable evidence: outbound Authorization field and diagnostics without
  token disclosure

### FR-0216
**Requirement**: Supported remote Confluence access shall use one token-only
invocation-local access context.

**Applicability**:
- non-help `setup` invocations during connection validation
- non-help `export` invocations

**Rationale**:
- Operators and tests need one authoritative source for the base URL and token
  used by each invocation.

**Acceptance Criteria**:
1. For this card, the remote-access context is the pair `(base_url, token)` used
   to validate setup authentication, resolve root pages, and acquire Confluence
   page or attachment data for the current invocation.
2. The remote-access context uses the effective base URL value selected under
   `FR-0219` as `base_url` and the effective token value selected under
   `FR-0219` as `token`; during setup validation, the entered base URL and
   entered token are treated as the highest-precedence effective values for the
   setup invocation only.
3. `base_url` and `token` are each non-empty and contain no TAB, LF, or CR.
4. The product sends exactly one HTTP Authorization field for authenticated
   Confluence requests, with the exact field value `Bearer <token>`, where
   `<token>` is the selected token value from criterion 2 with no case
   normalization, percent-decoding, percent-encoding, URL encoding, trimming, or
   splitting.
5. `base_url` syntax is valid only when it is an absolute `http://` or
   `https://` URL containing no userinfo component, query component, or fragment
   component, and whose path component is either empty, exactly `/`, or a
   slash-prefixed path whose final character is not `/`. For this card, exact
   forms with empty path and with path `/` are semantically equivalent root-path
   `base_url` values; any other valid `base_url` preserves its exact path prefix
   and does not add or remove a trailing slash.
6. For this card, a governed Confluence request target is the absolute-path and
   optional-query reference required by one setup current-user validation,
   root-page preflight, page acquisition, or attachment acquisition step before
   any `base_url` path prefix from criterion 5 is applied. Its path component
   `<target_path>` begins with `/`; it contains no scheme, authority, or
   fragment; and its optional query component `<target_query>` is either absent
   or is the exact query string bytes after `?`.
7. If `base_url` from criterion 5 is a root-path `base_url`, the effective
   request URL used for any governed access step has path exactly
   `<target_path>` from criterion 6 and has query component absent when
   `<target_query>` is absent or exactly equal to `<target_query>` when it is
   present.
8. If `base_url` from criterion 5 has a non-root preserved path prefix
   `<prefix>`, the effective request URL used for any governed access step has
   path exactly `<prefix><target_path>` and has query component absent when
   `<target_query>` is absent or exactly equal to `<target_query>` when it is
   present. The product does not strip, duplicate, normalize, or insert any
   additional path segment or slash between `<prefix>` and `<target_path>`, and
   does not rewrite `<target_query>`.
9. Every governed setup current-user validation, root-page preflight, page
   acquisition, and attachment acquisition step uses the effective request URL
   from criteria 6 through 8 together with the exact Bearer token Authorization
   field from criterion 4 and no alternative base URL or credential source.
10. The product uses one remote-access context consistently for root-page
    preflight and every later page or attachment acquisition step attempted by
    that same invocation.
11. A remote-access context is usable for the current invocation only when the
    active values satisfy every applicable requirement from criteria 3 through
    9 and the transport policy governed by `FR-0251` for that invocation.
12. If a governed operation cannot use one usable context, the governing card
    for that operation takes its defined failure route.

**Dependencies**:
- `FR-0219`
- `FR-0251`

**Traceability**:
- Area: configuration
- Observable evidence: consistent setup, page-access behavior, and Bearer
  Authorization under one invocation

### FR-0219
**Requirement**: Confluex shall select effective public configuration from
command-line values, explicit JSON config, user JSON config, and credential
process environment in one deterministic precedence order.

**Applicability**:
- non-help `export` invocations before invocation acceptance under
  `FR-0212`
- effective public configuration selection

**Rationale**:
- Operators need reproducible configuration without relying only on shell
  profile state, and secrets loaded from JSON files must have deterministic
  precedence.

**Acceptance Criteria**:
1. If `--config <file>` is supplied, the candidate explicit config path is
   exactly the normalized path produced from `<file>` under `FR-0158` and
   `FR-0159`.
2. If `--config <file>` is supplied and path normalization under criterion 1
   fails, the invocation is rejected under `FR-0019` before command work begins.
3. If `--config <file>` is supplied, the product evaluates the candidate config
   path from criterion 1 using non-following filesystem metadata under
   `FR-0154`.
4. If criterion 3 fails, or if criterion 3 reports path absence, symbolic link,
   directory, FIFO, socket, device, or any filesystem object kind other than
   regular file, the invocation is rejected under `FR-0019` before command work
   begins.
5. If `--config <file>` is supplied and criterion 3 reports regular file, the
   candidate explicit JSON config file is selected for that invocation.
6. If `--config <file>` is absent, no explicit JSON config file is selected.
7. Effective configuration precedence is exactly command-line option value, then
   selected explicit JSON config value, then user JSON config value, then
   process-environment credential value, then no value.
8. Command-line option precedence applies to these selector pairs:
   `--out <path>` over `outputRoot`, `--max-pages <n>` over `maxPages`,
   `--max-download-mib <n>` over `maxDownloadMib`, `--sleep-ms <n>` over
   `sleepMs`, `--max-find-candidates <n>` over `maxFindCandidates`,
   `--link-depth <n>` over `linkDepth`, and `--insecure` over `insecure`.
9. `CONFLUEX_CONFLUENCE_BASE_URL` and `CONFLUEX_CONFLUENCE_TOKEN` have no
   command-line option aliases in the public CLI.
10. Process-environment values do not supply output-root, run-limit, pacing,
    candidate-limit, link-depth, insecure-mode, or mode-changing option values.
11. JSON config values never supply hidden fallbacks for unsupported options,
    unsupported commands, or CLI-only mode-changing flags.
12. Public output redaction for secret effective values selected through this
    card is governed by `FR-0237`.
13. User and explicit config JSON parsing are governed by `FR-0246`.

**Dependencies**:
- `FR-0019`
- `FR-0036`
- `FR-0235`
- `FR-0154`
- `FR-0158`
- `FR-0159`
- `FR-0212`
- `FR-0237`
- `FR-0246`

**Traceability**:
- Area: configuration
- Observable evidence: selected explicit config reads, user config reads,
  credential environment reads, effective option selection, rejection timing

### FR-0237
**Requirement**: Public output channels shall redact secret configuration
values.

**Applicability**:
- stdout
- stderr
- debug artifacts
- setup diagnostics

**Rationale**:
- Operators need tokens loaded from JSON config, setup, or process environments
  to remain out of public CLI output.

**Acceptance Criteria**:
1. `CONFLUEX_CONFLUENCE_TOKEN` values, JSON config `confluenceToken` values, and
   setup-entered token values are classified as secret values.
2. Secret values are never emitted verbatim to stdout.
3. Secret values are never emitted verbatim to stderr.
4. Secret values are never emitted verbatim to debug artifacts.
5. Secret values are never emitted verbatim to setup diagnostics.
6. Authorization header values are classified as secret values.
7. Common token-bearing diagnostic keys, including `token`, `secret`,
   `password`, `authorization`, `apiToken`, `accessToken`, `refreshToken`,
   `bearerToken`, `confluenceToken`, and `pat`, are redacted when emitted in
   debug artifacts.
8. Retained report artifacts are governed by `FR-0085` through `FR-0091` and
   this card does not redact source-derived report fields.
9. If a source-derived report value equals a secret value selected under
   criterion 1, the owning report card governs the retained report
   serialization.
10. When a diagnostic must identify a token-related failure, it uses a stable
   reason token governed by the diagnostic or preflight card that owns that
   failure branch.

**Dependencies**:
- `FR-0039`
- `FR-0043`
- `FR-0085`
- `FR-0091`
- `FR-0216`
- `FR-0250`

**Traceability**:
- Area: configuration
- Observable evidence: CLI output, logs, and reports without token disclosure

### FR-0246
**Requirement**: User and explicit configuration shall use one closed JSON
schema.

**Applicability**:
- `confluex setup`
- non-help `export` invocations

**Rationale**:
- Operators need setup-selected base URL and token values to be reused without
  relying on shell profile state, and explicit config files must validate the
  same way as the user config file.

**Acceptance Criteria**:
1. On Linux and other XDG environments, the user config path is
   `$XDG_CONFIG_HOME/confluex/config.json` when `XDG_CONFIG_HOME` is non-empty;
   otherwise it is `$HOME/.config/confluex/config.json`.
2. On Windows, the user config path is `%APPDATA%\confluex\config.json`.
3. User config files and explicit config files selected by `--config <file>` are
   UTF-8 JSON object text decoded with fatal invalid-UTF-8 handling.
4. The supported JSON config keys are exactly the public JSON configuration
   keys governed by `FR-0235`.
5. `confluenceBaseUrl` and `confluenceToken` values must be JSON strings.
6. `insecure` values must be JSON booleans.
7. `outputRoot` values must be JSON strings.
8. `maxPages`, `maxDownloadMib`, and `maxFindCandidates` values must be JSON
   numbers that are safe positive integers.
9. `sleepMs` and `linkDepth` values must be JSON numbers that are safe
   non-negative integers.
10. If setup writes a user config file, setup writes only `confluenceBaseUrl`
    and `confluenceToken`.
11. If the user config file is absent, user config contributes no values to
    effective configuration selection.
12. If a selected JSON config file exists but is not valid UTF-8 JSON object
    text, non-help `export` invocations are rejected under `FR-0019` before
    command work begins.
13. If a selected JSON config object contains a key other than the criterion-4
    keys, non-help `export` invocations are rejected under `FR-0019` before
    command work begins.
14. If any present JSON config value does not satisfy criteria 5 through 9,
    non-help `export` invocations are rejected under `FR-0019` before command
    work begins.
15. Token redaction is governed by `FR-0237`.

**Dependencies**:
- `FR-0019`
- `FR-0014`
- `FR-0216`
- `FR-0237`
- `FR-0235`

**Traceability**:
- Area: configuration
- Observable evidence: setup-written config, explicit config loading, and
  effective configuration

### FR-0251
**Requirement**: Remote Confluence transport trust shall default to verified
HTTPS and require explicit insecure selection for weaker transport.

**Applicability**:
- non-help `setup` invocations during connection validation
- non-help `export` invocations

**Rationale**:
- Operators need bearer-token transport to fail closed unless they explicitly
  request insecure export behavior.

**Acceptance Criteria**:
1. If insecure mode is not selected for an `export` invocation, `FR-0216`
   accepts only `https://` `base_url` values.
2. If insecure mode is selected for an `export` invocation, `FR-0216` accepts
   `https://` and `http://` `base_url` values that otherwise satisfy
   `FR-0216`.
3. Setup never selects insecure mode.
4. Setup rejects `http://` `base_url` values before writing user config.
5. For `https://` `base_url` values, insecure mode disabled means TLS
   certificate verification is enabled for Node.js remote requests and the
   Markdown exporter dependency.
6. For `https://` `base_url` values, insecure mode enabled means TLS
   certificate verification is disabled only for the current export invocation.
7. When insecure mode is active, stderr emits the insecure warning governed by
   `FR-0009` before authenticated Confluence requests are attempted.
8. Insecure selection does not imply `--debug`, `--zip`, `--include-children`,
   `--resume`, `--no-fail-fast`, `--plan-only`, or any run-limit option.

**Dependencies**:
- `FR-0009`
- `FR-0216`
- `FR-0219`

**Traceability**:
- Area: configuration
- Observable evidence: accepted/rejected base URLs, TLS behavior, exporter
  config, insecure warning
