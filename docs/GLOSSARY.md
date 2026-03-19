# Glossary


- **accepted invocation**: A CLI invocation that passes validation and begins the
  requested command workflow.
- **command work**: The first externally observable workflow behavior of an
  accepted invocation other than help rendering.
- **completed run**: An accepted `export` or `plan` run that reaches
  `RUN_COMPLETE` without a signal interruption, configured stop condition, or
  runtime failure before completion handling.
- **blocking reason**: A run condition represented in `summary.txt` by the
  tokens `unresolved_links`, `scope_findings`, or `failed_operations`.
- **canonical page identifier**: The unsigned base-10 page-id string produced by
  successful page resolution or page-access verification.
- **child tree**: The recursive descendant tree of the root page.
- **effective encryption recipient**: The encryption-recipient identity in
  effect for the current command after applying this precedence order:
  accepted command-line `--encryption-key`, then saved default recipient, then
  no recipient.
- **logical plain output root**: The directory path selected explicitly or
  generated for a run before any optional encrypted replacement is created.
- **page-local failure**: A failure confined to one page's acquisition,
  interpretation, materialization, or attachment-processing work.
- **plain output root**: An unencrypted output-root directory that remains
  directly inspectable on disk.
- **processed page**: A page in run scope whose command-specific page-processing
  work begins after the product has established one unique page identity for
  that page. Each processed page is represented by exactly one row in
  `manifest.tsv` for the current run. In a resumed export run this includes
  pages whose payload was reused and pages materialized afresh. A scope
  candidate that fails before one unique page identity is established is not a
  processed page.
- **process current working directory**: The filesystem directory from which the
  CLI invocation is launched.
- **recovery-compatible output root**: An existing plain export output root whose
  prior reports satisfy the resume rules in this document.
- **rejected invocation**: A CLI invocation that fails validation before command
  work begins.
- **root page**: The page selected by `--page-id` as the starting point of an
  `export` or `plan` run.
- **runtime failure**: A non-page-local failure after command work has started
  that prevents the accepted command from completing according to its normal
  workflow.
- **scope finding**: A machine-readable finding that reduces confidence in scope
  completeness.
- **support profile**: The documented set of internal-link forms and parsing
  behaviors that the product claims to support.
