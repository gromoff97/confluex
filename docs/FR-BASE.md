# Shared Primitive Requirements


### FR-0124
**Requirement**: Quoted path strings shall use one stable serialization across
governed CLI text and governed artifact text.

**Applicability**:
- all governed stdout lines, stderr lines, report-file fields, and other
  governed artifact text that use a quoted path string

**Rationale**:
- Operators and automation need one reusable path-serialization rule rather than
  card-local quoting conventions.

**Acceptance Criteria**:
1. A quoted path string begins with `"` and ends with `"` and has no
   surrounding ASCII space, TAB, LF, or CR outside those delimiters.
2. The interior is serialized left-to-right from the path value's Unicode code
   points excluding surrogate code points `U+D800` through `U+DFFF`, using
   exactly these escapes: `"` as `\"`, `\` as `\\`, `U+0008` as `\b`,
   `U+0009` as `\t`, `U+000A` as `\n`, `U+000C` as `\f`, `U+000D` as `\r`, and
   every other control character from `U+0000` through `U+001F` as `\u00XX`
   with uppercase hexadecimal digits.
3. Every such code point not escaped by criterion 2 is emitted directly as
   UTF-8 text; optional JSON escapes such as `\/` or `\u` for non-control
   characters are forbidden.
4. Deserializing the entire quoted path string as one JSON string literal yields
   the exact path value with no added, removed, or normalized path characters.

**Dependencies**:
- None

**Traceability**:
- Area: shared primitives
- Observable evidence: quoted path values in stdout, stderr, report fields, and
  other governed artifact text

### FR-0125
**Requirement**: The shared absence token shall use one stable token text and
whole-value absence serialization across governed CLI text and report files.

**Applicability**:
- all governed stdout lines, stderr lines, and report-file fields that use the
  shared absence token as an absence representation

**Rationale**:
- Operators and automation need one reusable absence-token rule rather than
  card-local spellings for missing values.

**Acceptance Criteria**:
1. The shared absence token is exactly the lowercase ASCII text `none`.
2. When a governed line or field uses the shared absence token, the entire
   serialized absence value is exactly `none` with no quoting, surrounding
   ASCII space, TAB, LF, CR, or additional delimiters inside that value.
3. When a governed line format embeds the shared absence token inside a larger
   line, the exact token text for the absence occurrence is `none`; the
   containing card governs any required surrounding indentation, prefixes,
   suffixes, separators, or other outer line framing.
4. A governed field or line occurrence uses the shared absence token for
   absence only when its serialized absence value under criteria 2 and 3 is the
   bare token text `none`.
5. If field-local normalization, escaping, or composition rules for a governed
   field or line occurrence could otherwise produce that same bare token text
   `none` as valid non-absence data before outer line framing, that occurrence
   does not permit the colliding non-absence data unless its governing
   requirement defines a deterministic distinction between absence and that
   non-absence data.
6. Any deterministic distinction required by criterion 5 is itself governed and
   observable: the colliding non-absence data is either rejected, serialized to
   a value different from bare `none`, or serialized with additional governed
   structure that distinguishes it from absence.
7. If no such deterministic distinction is defined for an occurrence from
   criterion 5, the colliding non-absence data is invalid for that occurrence in
   this corpus.

**Dependencies**:
- `FR-0154`

**Traceability**:
- Area: shared primitives
- Observable evidence: stable absence-token text and whole-value absence
  serialization in governed text and report fields

### FR-0126
**Requirement**: Delimited token lists shall use one stable serialization across
governed CLI text and report files.

**Applicability**:
- all governed stdout lines, stderr lines, and report-file fields that use zero
  or more machine-readable tokens whose non-empty case serializes as a
  delimited token list

**Rationale**:
- Operators and automation need one reusable list-serialization rule rather than
  card-local delimiter and spacing conventions.

**Acceptance Criteria**:
1. A zero-item token-list case serializes as the shared absence token defined by
   `FR-0125`, not as an empty delimited token list.
2. A non-empty delimited token list serializes one or more tokens separated by
   single ASCII commas.
3. The complete serialized non-empty token-list value contains no leading or
   trailing ASCII space, TAB, LF, or CR.
4. A token in a non-empty delimited token list is one or more ASCII bytes in
   the inclusive range `0x21` through `0x7E`, excluding ASCII comma.
5. A token in a non-empty delimited token list is never exactly the shared
   absence token defined by `FR-0125`; the text `none` is reserved for the
   zero-item case from criterion 1 and is invalid as a token-list member.
6. A serialized non-empty token list contains no empty elements, leading
   delimiter, trailing delimiter, or repeated delimiter.
7. A single-item token list serializes as that one token with no comma.

**Dependencies**:
- `FR-0125`

**Traceability**:
- Area: shared primitives
- Observable evidence: stable token-list serialization in governed text and
  report fields

### FR-0148
**Requirement**: Governed filesystem-path consumers shall derive every consumed
path value, equality decision, and descendant decision from the authoritative
shared path cards.

**Applicability**:
- `--out <path>`
- generated output-root candidate paths selected by owning run-lifecycle cards
- current-working-directory sources used by relative-path normalization and
  generated root selection under this card

**Rationale**:
- Path comparisons, artifact names, summaries, and result lines need one shared
  path contract so that consumers do not invent conflicting local path rules.

**Acceptance Criteria**:
1. A governed filesystem-path consumer acquires its path source and current-
   platform typing under `FR-0158`.
2. If a governed filesystem-path consumer uses a path for filesystem checks,
   directory creation, artifact naming, summary reporting, or as an operand for
   later path comparison, the consumed path value is the path-normalized form
   produced under `FR-0159` from that source.
3. If a governed filesystem-path consumer compares two governed filesystem
   paths for sameness, it uses the normalized-path equality rule from
   `FR-0160`.
4. If a governed filesystem-path consumer decides whether one governed
   filesystem path is inside another, it uses the path-segment descendant
   relation from `FR-0161`.
5. A governed filesystem-path consumer does not define or rely on a second path
   acquisition, normalization, equality, or descendant rule that conflicts with
   criteria 1 through 4.

**Dependencies**:
- `FR-0158`
- `FR-0159`
- `FR-0160`
- `FR-0161`

**Traceability**:
- Area: shared primitives
- Observable evidence: normalized paths in output-root, package lifecycle
  documentation, and package smoke behavior

### FR-0150
**Requirement**: Governed relative path strings shall use one safe segment
serialization form.

**Applicability**:
- payload-folder relative paths
- ZIP entry relative paths

**Rationale**:
- Relative path strings appear in several machine-readable artifacts and
  placeholder-bound artifact locations and need one segment and separator
  contract.

**Acceptance Criteria**:
1. A governed relative path string is UTF-8 text containing one or more
   non-empty path segments separated by ASCII `/`.
2. A governed relative path string contains no leading `/`, trailing `/`,
   backslash, colon, empty segment, NUL, TAB, LF, or CR.
3. No segment in a governed relative path string is exactly `.` or `..`.
4. A governed relative path string is never an absolute path: because criterion
   2 forbids leading `/`, backslash, and colon, it cannot encode a POSIX
   absolute path, Windows root-relative path, Windows drive-relative path,
   Windows drive absolute path, Windows UNC path, or Windows extended/device
   path.
5. A governed relative path string is joined to a containing filesystem root by
   interpreting each serialized segment as one child path segment; `/` is a
   separator and is never data inside a segment.
6. Bytewise sorting of governed relative path strings compares the UTF-8 bytes
   of the complete serialized relative path.

**Dependencies**:
- None

**Traceability**:
- Area: shared primitives
- Observable evidence: payload folder paths and ZIP entry paths

### FR-0152
**Requirement**: The currently executing Confluex runtime root shall use one
shared self-location acquisition rule.

**Applicability**:
- all currently executing Confluex CLI invocations that explicitly consume the
  runtime root or runtime-root source string

**Rationale**:
- Package smoke and release checks need one command-independent authoritative
  source for the currently executing runtime root.

**Acceptance Criteria**:
1. The product obtains one runtime-entrypoint path for the current invocation
   from a process self-location source supplied by the active host runtime: the
   absolute filesystem path of the current file that directly defines the
   `confluex` command entrypoint.
2. For this card, the runtime-entrypoint path from criterion 1 is the concrete
   filesystem path of the file that directly defines the current `confluex`
   command entrypoint; wrapper launchers, symbolic-link launchers, `.cmd`
   shims that delegate outside their own directory tree, and any other indirect
   launcher path do not qualify as the runtime-entrypoint path for this card.
3. Candidate runtime-root directories are the lexical ancestor directories of
   the absolute runtime-entrypoint path from criterion 2, evaluated from nearest
   ancestor to farthest ancestor.
4. A candidate runtime-root directory qualifies only when non-following
   filesystem metadata under `FR-0154` reports that the candidate is a
   directory, its exact child path `package.json` is a regular file, its exact
   descendant path `bin/confluex.js` is a regular file, its exact child path
   `dist` is a directory, and at least one regular file exists under the exact
   descendant path `dist/`.
5. The currently executing Confluex runtime root is the first qualifying
   candidate runtime-root directory from criterion 4.
6. If criteria 1 through 5 cannot identify one absolute runtime root path for
   the current invocation, any downstream card that consumes the runtime-root
   source string takes its defined failure route.
7. The runtime-root source string consumed by downstream cards is exactly the
   absolute path string from criterion 5 before downstream
   path normalization, platform validation, support-root inventory checks, or
   overlap checks.
8. This card defines only the shared runtime-root primitive; downstream cards
   govern path normalization, failure routing, support-root inventories, and
   overlap checks for the contexts that consume it.

**Dependencies**:
- `FR-0154`
- `FR-0215`

**Traceability**:
- Area: shared primitives
- Observable evidence: runtime-root-dependent package smoke behavior

### FR-0153
**Requirement**: Path-normalization failure routing shall remain source-specific.

**Applicability**:
- public operator-supplied path sources acquired under `FR-0158` and normalized
  under `FR-0159`
- generated output-root candidate paths normalized under `FR-0159`

**Rationale**:
- Shared lexical path semantics need one authoritative home, but each consuming
  workflow still needs its own authoritative rejection or runtime-failure route.

**Acceptance Criteria**:
1. For operator-supplied `--out` under `FR-0021`, any path-normalization failure
   under `FR-0159` rejects the invocation under `FR-0019`.
2. For configured `CONFLUEX_OUTPUT_ROOT` under `FR-0021`, any
   path-normalization failure under `FR-0159` rejects the invocation under
   `FR-0019`.
3. Generated output-root selection under `FR-0055` uses the generated
   output-root candidate path and current-working-directory source as
   path-normalization inputs.

**Dependencies**:
- `FR-0019`
- `FR-0021`
- `FR-0232`
- `FR-0055`
- `FR-0158`
- `FR-0159`
- `FR-0219`

**Traceability**:
- Area: shared primitives
- Observable evidence: `FR-0019` rejected-invocation stderr and side-effect
  behavior for path sources and `FR-0055` generated-output-root rejection

### FR-0154
**Requirement**: Filesystem metadata evaluations described as non-following
filesystem metadata shall inspect the exact path without following a symbolic
link at that path.

**Applicability**:
- any requirement in this corpus that evaluates a filesystem path or an
  existing ancestor path using the term `non-following filesystem metadata`

**Rationale**:
- Path-kind checks need one reusable exact-path metadata rule so that symbolic
  links are classified as links instead of being silently dereferenced.

**Acceptance Criteria**:
1. A non-following filesystem metadata evaluation attempts to determine the
   filesystem state of the exact path supplied to that evaluation without
   following a symbolic link at that path.
2. If the exact path is absent, the evaluation result is path absence.
3. If the exact path exists as a symbolic link, the evaluation result is
   `symbolic link`, and the evaluation does not require the link target to
   exist or be inspected.
4. If the exact path exists and is not a symbolic link, the evaluation reports
   the filesystem object kind visible at that exact path, including `directory`,
   `regular file`, `FIFO`, `socket`, `device`, or another non-directory object
   kind when the host platform exposes one.
5. If the product cannot determine the criterion 2, 3, or 4 result for a
   reason other than path absence, the metadata evaluation fails.

**Dependencies**:
- None

**Traceability**:
- Area: shared primitives
- Observable evidence: exact-path object-kind checks that reject or accept
  symlinks, directories, regular files, FIFOs, sockets, devices, and absence

### FR-0158
**Requirement**: Governed path sources shall use one shared platform-sensitive
input contract.

**Applicability**:
- operator-supplied path options
- public configuration environment-value sources used by owning cards to select
  output-root paths
- public env-file value sources selected under `FR-0219` and used by owning
  cards to select output-root paths
- current-working-directory sources used by relative-path normalization and
  generated root selection

**Rationale**:
- Path normalization needs one authoritative source contract for the inputs it
  receives before any lexical processing begins.

**Acceptance Criteria**:
1. A governed path source is a non-empty sequence of Unicode code points
   excluding surrogate code points `U+D800` through `U+DFFF` and containing no
   NUL, LF, or CR.
2. On POSIX, operator-supplied path options use the exact byte sequence of the
   effective option value selected by the owning requirement from process argv,
   environment-value sources use the exact byte sequence obtained when the
   product reads the named environment variable, env-file value sources use the
   exact byte sequence of the parsed value selected under `FR-0219` after
   ignored-line handling, quote-pair removal, duplicate-key resolution, and
   key selection, and current-working-directory sources use the exact byte
   sequence obtained when the product asks for the process current working
   directory and do not use `$PWD`.
3. Producing the Unicode string from any POSIX source requires lossless UTF-8
   decoding with no replacement or omission; if the source byte sequence is not
   valid UTF-8 or would require replacement or omission, path-source
   acquisition fails.
4. On Windows, operator-supplied path options use the Unicode argument value
   received after command-line parsing, environment-value sources use the
   Unicode value obtained when the product reads the named environment
   variable, env-file value sources use the exact Unicode string of the parsed
   value selected under `FR-0219` after ignored-line handling, quote-pair
   removal, duplicate-key resolution, and key selection, and current-working-
   directory sources use the Unicode path obtained when the product asks for the
   process current working directory.
5. If any governed Windows path source cannot supply a Unicode string,
   path-source acquisition fails.
6. The platform is Windows when the running Confluex process is a native
   process on Microsoft Windows outside Cygwin or MSYS2 compatibility layers,
   POSIX when the running Confluex process is in Linux, macOS, FreeBSD,
   OpenBSD, NetBSD, or WSL user space, and unsupported otherwise.

**Dependencies**:
- `FR-0219`

**Traceability**:
- Area: shared primitives
- Observable evidence: accepted path-source decoding and platform classification

### FR-0159
**Requirement**: Governed path sources shall use one shared lexical
normalization and serialization form.

**Applicability**:
- operator-supplied path sources
- generated output-root candidate paths selected by owning run-lifecycle cards
- current-working-directory sources used by relative-path normalization and
  generated root selection under this card

**Rationale**:
- Path comparisons, artifact names, summaries, and result lines need one shared
  normalization model rather than option-specific interpretations.

**Acceptance Criteria**:
1. If a path-normalization input is relative for the current platform after
   path classification under criteria 5 through 13, the product joins it to the
   process current working directory as path segments before segment
   normalization; the process current working directory used for this join is
   an absolute path.
2. If a path-normalization input is absolute for the current platform after
   path classification under criteria 5 through 13, the product applies
   segment normalization directly to that input.
3. Segment normalization preserves the recognized filesystem root, treats
   repeated path separators after the root as one separator so that they do
   not create empty path segments, removes `.` path segments, and resolves
   each `..` segment by removing the preceding non-root segment when one
   exists; a `..` segment at the filesystem root leaves the path at that root.
4. Unless the normalized path is exactly a filesystem root, trailing path
   separators are removed as part of the normalized path form.
5. On POSIX, `/` is the only path separator during classification and segment
   normalization, `\` is ordinary segment text, the only recognized filesystem
   root is exactly `/`, any non-empty input beginning with `/` is absolute, any
   other non-empty input is relative, repeated leading `/` characters collapse
   to that one root, and normalized paths serialize with `/` as the path
   separator.
6. On Windows, both `\` and `/` are path separators during path classification
   and segment normalization.
7. On Windows, a drive filesystem root is an ASCII letter followed by `:`,
   followed by one or more `\` or `/`; normalized drive-root serialization uses
   the uppercase drive letter followed by `:\`, and normalized drive-absolute
   child paths serialize that root followed by normalized child segments
   separated with `\`, for example `C:\foo\bar`.
8. On Windows, a UNC path has a UNC root prefix that begins with exactly two
   path separators, then `<server>`, then one path separator, then `<share>`,
   where `<server>` and `<share>` are non-empty strings containing no `\`, `/`,
   NUL, LF, or CR, and `<server>` is not exactly `?` or `.`. During
   classification, the two leading separators and the separator between
   `<server>` and `<share>` may each be `\` or `/`, and a UNC path may end at
   that root prefix or continue with one or more child segments separated with
   `\` or `/`. If the input ends at the UNC root prefix, with or without one
   trailing path separator, the normalized path is exactly the UNC filesystem
   root `\\<server>\<share>\`. If one or more additional path separators follow
   the UNC root prefix and no child segment follows those separators, the
   normalized path is still exactly the UNC filesystem root
   `\\<server>\<share>\`. If child segments follow the UNC root prefix, segment
   normalization from criterion 3 applies to those child segments, and
   normalized UNC serialization uses `\\<server>\<share>\` followed by the
   normalized child segments separated with `\`. Normalized UNC serialization
   preserves `<server>` and `<share>` exactly apart from separator
   normalization, and performs no case folding or alias normalization on either
   component.
9. On Windows, a path that is exactly one path separator, or begins with
   exactly one path separator before the first non-separator character, such as
   `\`, `/`, `\foo`, or `/foo`, is root-relative and path normalization fails.
10. On Windows, a path beginning with an ASCII letter followed by `:` and then
    a non-separator character, such as `C:foo`, is drive-relative and path
    normalization fails.
11. On Windows, a path beginning with an ASCII letter followed by `:` and then
    ending, such as `C:`, is drive-relative and path normalization fails.
12. On Windows, extended or device path prefixes beginning with `\\?\`,
    `\\.\`, `//?/`, or `//./` cause path normalization to fail.
13. On Windows, a path that begins with exactly two path separators but does
    not begin at the start of the input string with a valid UNC root prefix
    under criterion 8 causes path normalization to fail, and a path that begins
    with three or more path separators also causes path normalization to fail.
    After criteria 7 through 13 classify every Windows drive-absolute, UNC, and
    invalid-prefixed input, every remaining non-empty Windows input is relative.
14. On Windows, before criterion 3 removes `.` or resolves `..`, every parsed
    non-root path segment other than the special dot segments `.` and `..`,
    every parsed UNC `<server>`, and every parsed UNC `<share>` must be one or
    more Unicode code points, must contain no control code point from `U+0000`
    through `U+001F`, must contain no `:`, `*`, `?`, `"`, `<`, `>`, `|`, `\`,
    or `/`, and must not end with ASCII space or `.`. In addition, every parsed
    non-root path segment's basename before the first `.` must not equal `CON`,
    `PRN`, `AUX`, `NUL`, `COM1` through `COM9`, or `LPT1` through `LPT9` after
    mapping ASCII letters `a` through `z` to `A` through `Z` and leaving every
    other code point unchanged; otherwise path normalization fails.
15. Segment text other than removed `.` and `..` segments is preserved exactly
    in the normalized path serialization, subject to the Windows segment
    constraints in criterion 14; this requirements corpus does not rewrite
    non-root path segments, UNC `<server>`, or UNC `<share>` beyond separator
    normalization and the drive-letter uppercasing required by criterion 7.
16. If a relative path-normalization input requires the process current working
    directory and that directory cannot be obtained, is not absolute for the
    current platform, is not itself a valid current-platform
    path-normalization input under criteria 1 through 15, or does not exist as
    a directory when evaluated using non-following filesystem metadata under
    `FR-0154`, path normalization fails.

**Dependencies**:
- `FR-0158`
- `FR-0154`

**Traceability**:
- Area: shared primitives
- Observable evidence: normalized paths in output-root and generated
  output-root behavior

### FR-0160
**Requirement**: Normalized filesystem paths shall use one shared equality
rule.

**Applicability**:
- normalized filesystem paths governed by `FR-0159`

**Rationale**:
- Path consumers need a single exact comparison contract after normalization.

**Acceptance Criteria**:
1. On POSIX, normalized path equality compares the recognized root under
   `FR-0159` exactly and then compares the ordered preserved segment strings
   exactly.
2. On Windows, normalized path equality first requires both paths to have the
   same kind of normalized root under `FR-0159`, compares the normalized drive
   root from `FR-0159` exactly when both paths are drive rooted, compares
   preserved UNC `<server>` and `<share>` strings by mapping ASCII letters `a`
   through `z` to `A` through `Z` and leaving every other code point unchanged
   when both paths are UNC rooted, and then compares the preserved non-root
   segment sequences for both drive and UNC paths under that same ASCII-folding
   rule in order, element by element, with equal sequence length required; the
   normalized path serialization from `FR-0159` otherwise remains unchanged.

**Dependencies**:
- `FR-0159`

**Traceability**:
- Area: shared primitives
- Observable evidence: normalized path equality for log-path rejection and
  output-root comparison

### FR-0161
**Requirement**: Normalized filesystem paths shall use one shared descendant
relation.

**Applicability**:
- normalized filesystem paths governed by `FR-0159`

**Rationale**:
- Consumers need one exact prefix relation after normalization and equality.

**Acceptance Criteria**:
1. A normalized path is a path-segment descendant of another normalized path
   when both paths have equal roots under the applicable equality rule from
   `FR-0160` and the ancestor's ordered segment sequence is a proper prefix of
   the descendant's ordered segment sequence under that same segment
   comparison rule.

**Dependencies**:
- `FR-0159`
- `FR-0160`

**Traceability**:
- Area: shared primitives
- Observable evidence: descendant-gated log-path and output-root behavior
