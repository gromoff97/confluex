# Configuration Requirements


### FR-0045
**Requirement**: `config` shall show the saved default encryption-recipient
state.

**Applicability**:
- `confluex config` with neither `--encryption-key` nor `--clear-encryption-key`

**Rationale**:
- Operators need an explicit way to inspect saved recipient state.

**Acceptance Criteria**:
1. In this corpus, the saved default encryption recipient state is one
   machine-local, OS-user-local state shared by all Confluex invocations run by
   that OS user account, independent of current working directory and resolved
   install target.
2. An accepted non-help `config` invocation with neither `--encryption-key` nor
   `--clear-encryption-key` emits exactly one stdout line in the format
   `default_encryption_key=<value>`; stdout is UTF-8 text with LF line endings
   and contains no bytes after that line's terminating LF.
3. If a default encryption recipient is saved in the shared state from criterion
   1, `<value>` is the saved value.
4. If no default encryption recipient is saved in that shared state, the line
   uses the shared absence token governed by `FR-0125` and is therefore
   exactly `default_encryption_key=none`.
5. For a saved recipient, `<value>` is the entire suffix after the first `=`
   character through the end of that line; because `FR-0030` rejects
   non-UTF-8 values, TAB, LF, CR, and the exact value `none`, no additional
   quoting or escaping is applied.
6. Accepted `config` read-only invocations that complete write nothing to
   `stderr`.
7. The accepted invocation exit code is governed by `FR-0118`.
8. Accepted `config` read-only invocations that fail after command work begins
   are governed by `FR-0142`.

**Dependencies**:
- `FR-0030`
- `FR-0118`
- `FR-0125`
- `FR-0142`

**Traceability**:
- Area: configuration
- Observable evidence: stdout configuration line, empty stderr, exit code

### FR-0046
**Requirement**: `config` shall save a default encryption-recipient identity.

**Applicability**:
- `confluex config --encryption-key <value>`

**Rationale**:
- Operators need a saved default recipient that can be reused by encrypted runs.

**Acceptance Criteria**:
1. If `<value>` is allowed under `FR-0030`, `config --encryption-key <value>`
   saves that value as the shared default encryption recipient governed by
   `FR-0045`.
2. The same invocation emits exactly one stdout line
   `default_encryption_key=<value>` using the saved-value serialization and
   single-line UTF-8 LF-bounded stdout contract governed by `FR-0045`.
3. A later `confluex config` invocation with neither `--encryption-key` nor
   `--clear-encryption-key` emits the same saved value from that shared state.
4. Accepted `config --encryption-key <value>` invocations that complete write
   nothing to `stderr`.
5. The accepted invocation exit code is governed by `FR-0118`.
6. Accepted `config --encryption-key <value>` invocations that fail after command
   work begins are governed by `FR-0142`.

**Dependencies**:
- `FR-0030`
- `FR-0045`
- `FR-0118`
- `FR-0142`

**Traceability**:
- Area: configuration
- Observable evidence: immediate stdout output and later persisted configuration
  state

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
2. If the current invocation is an `export` or `plan` command launched by the
   live-regression harness under `FR-0138`, the current invocation uses the
   selftest-harness access branch: its remote-access context uses
   `CONFLUEX_SELFTEST_CONFLUENCE_BASE_URL` as `base_url` and
   `CONFLUEX_SELFTEST_CONFLUENCE_TOKEN` as `token`.
3. Any applicability-case invocation not covered by criterion 2 uses the
   external-confluence access branch.
4. In the external-confluence access branch, the remote-access context uses the
   effective `CONFLUEX_CONFLUENCE_BASE_URL` value as `base_url` and the
   effective `CONFLUEX_CONFLUENCE_TOKEN` value as `token`. Effective values are
   selected under `FR-0219`.
5. In either access branch, every branch-specific value named by criterion 2 or
   4 is non-empty and contains no TAB, LF, or CR.
6. In either access branch, the product sends exactly one HTTP Authorization
   field for authenticated Confluence requests, with the exact field value
   `Bearer <token>`, where `<token>` is the selected token value from criterion
   2 or 4 with no case normalization, percent-decoding, percent-encoding, URL
   encoding, trimming, or splitting.
7. The product does not read or accept `CONFLUEX_CONFLUENCE_USERNAME`,
   `CONFLUEX_CONFLUENCE_PASSWORD`, `CONFLUEX_SELFTEST_CONFLUENCE_USERNAME`, or
   `CONFLUEX_SELFTEST_CONFLUENCE_PASSWORD` to form a remote-access context.
8. In either access branch, `base_url` is usable only when it is an absolute
   `http://` or `https://` URL containing no userinfo component, query
   component, or fragment component, and whose path component is either empty,
   exactly `/`, or a slash-prefixed path whose final character is not `/`. For
   this card, exact forms with empty path and with path `/` are semantically
   equivalent root-path `base_url` values; any other usable `base_url`
   preserves its exact path prefix and does not add or remove a trailing slash.
9. For this card, a governed Confluence request target is the absolute-path and
   optional-query reference required by one governed root-page preflight,
   `doctor --page-id`, page acquisition, or attachment acquisition step before
   any `base_url` path prefix from criterion 8 is applied. Its path component
   `<target_path>` begins with `/`; it contains no scheme, authority, or
   fragment; and its optional query component `<target_query>` is either absent
   or is the exact query string bytes after `?`.
10. If `base_url` from criterion 8 is a root-path `base_url`, the effective
    request URL used for any governed access step has path exactly
    `<target_path>` from criterion 9 and has query component absent when
    `<target_query>` is absent or exactly equal to `<target_query>` when it is
    present.
11. If `base_url` from criterion 8 has a non-root preserved path prefix
    `<prefix>`, the effective request URL used for any governed access step has
    path exactly `<prefix><target_path>` and has query component absent when
    `<target_query>` is absent or exactly equal to `<target_query>` when it is
    present. The product does not strip, duplicate, normalize, or insert any
    additional path segment or slash between `<prefix>` and `<target_path>`, and
    does not rewrite `<target_query>`.
12. Every governed root-page preflight, `doctor --page-id`, page acquisition,
    and attachment acquisition step in either access branch uses the effective
    request URL from criteria 9 through 11 together with the exact Bearer token
    Authorization field from criterion 6 and no alternative base URL or
    credential source.
13. The product uses one access branch and one remote-access context
    consistently for root-page preflight, `doctor --page-id`, and every later
    page or attachment acquisition step attempted by that same invocation.
14. A remote-access context is usable for the current invocation only when the
    active access branch satisfies every applicable requirement from criteria 5
    through 12 for that invocation.
15. If a governed operation cannot use one usable context from the active
    access branch, the governing card for that operation takes its defined
    failure route.

**Dependencies**:
- `FR-0138`
- `FR-0219`

**Traceability**:
- Area: configuration
- Observable evidence: consistent page-access behavior and Bearer
  Authorization under one invocation

### FR-0219
**Requirement**: Confluex shall select one env-file source before reading
effective Confluence configuration.

**Applicability**:
- accepted non-help `export`, `plan`, `doctor`, and `selftest` invocations
  whose closed option set includes `--env-file <file>`

**Rationale**:
- Operators need reproducible configuration without relying only on shell
  profile state, and secrets loaded from files must have deterministic
  precedence.

**Acceptance Criteria**:
1. If `--env-file <file>` is supplied, the selected env file is exactly
   `<file>` after path normalization under `FR-0159`; `./.confluex.env` is not
   read for that invocation.
2. If `--env-file <file>` is supplied and the selected file cannot be read as a
   regular UTF-8 text file, the invocation is rejected before command work
   begins.
3. If `--env-file <file>` is absent and `./.confluex.env` exists in the current
   working directory as a regular file, that file is the selected env file.
4. If `--env-file <file>` is absent and `./.confluex.env` does not exist, no env
   file is selected.
5. An env-file line whose first non-space byte is `#`, or whose content is empty
   after removing trailing LF, is ignored.
6. A non-ignored env-file line must contain `KEY=value`; the key is trimmed of
   surrounding ASCII space and TAB, must be non-empty, and must contain no `=`,
   NUL, LF, or CR. The value is the bytes after the first `=`, except that one
   surrounding double-quote pair is removed when both the first and final value
   bytes are `"`.
7. Effective configuration precedence is exactly command-line option value,
   then selected env-file value, then process environment value, then no value.
8. Env-file values never supply hidden fallbacks for unsupported options or
   removed credential names.
9. Secret effective values, including `CONFLUEX_CONFLUENCE_TOKEN` and
   `CONFLUEX_SELFTEST_CONFLUENCE_TOKEN`, are never emitted to stdout, stderr,
   logs, reports, or diagnostic fields.

**Dependencies**:
- `FR-0036`
- `FR-0159`

**Traceability**:
- Area: configuration
- Observable evidence: selected env-file reads, effective option selection,
  rejection timing, absence of secret values in output

### FR-0047
**Requirement**: `config` shall clear the saved default encryption-recipient
identity.

**Applicability**:
- `confluex config --clear-encryption-key`

**Rationale**:
- Operators need a deterministic way to remove a previously saved default.

**Acceptance Criteria**:
1. If a shared default encryption recipient governed by `FR-0045` exists,
   `config --clear-encryption-key` removes it.
2. If no shared default encryption recipient governed by `FR-0045` exists,
   `config --clear-encryption-key` completes idempotently and leaves the
   shared saved-default state absent.
3. The same invocation emits exactly one stdout line
   `default_encryption_key=none`, using the shared absence token governed by
   `FR-0125`; stdout uses the single-line UTF-8 LF-bounded stdout contract
   governed by `FR-0045`.
4. A later `confluex config` invocation with neither `--encryption-key` nor
   `--clear-encryption-key` emits `default_encryption_key=none`.
5. Accepted `config --clear-encryption-key` invocations that complete write
   nothing to `stderr`.
6. The accepted invocation exit code is governed by `FR-0118`.
7. Accepted `config --clear-encryption-key` invocations that fail after command
   work begins are governed by `FR-0142`.

**Dependencies**:
- `FR-0045`
- `FR-0118`
- `FR-0125`
- `FR-0142`

**Traceability**:
- Area: configuration
- Observable evidence: immediate stdout output and later persisted configuration
  state
