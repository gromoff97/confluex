# Confluex Requirements

This document defines the current functional and UX contract for `confluex`.
Each requirement is written to satisfy `CIRCUS MATTA`:

- `Completeness`: covers the current product surface end to end
- `Independent`: each requirement is atomic
- `Realisable` and `Achievable`: implementable in the current shell architecture
- `Consistency`: does not contradict other requirements
- `Unambiguity`: observable outcome is explicit
- `Specific`: written for this CLI, not generic tooling
- `Measurable` and `Testable`: acceptance can be checked by black-box tests
- `Acceptable`: aligned with expected operator workflow
- `Traceable`: every requirement has an ID and test references

## CLI Contract

### UX-CLI-001
The CLI shall support explicit subcommands `export`, `plan`, `doctor`, `config`, `install`, and `uninstall`.

Acceptance:
- `export` performs a real export
- `plan` performs a dry-run
- `doctor` performs environment and access diagnostics
- `config` manages the saved default encryption key
- `install` installs the tool
- `uninstall` removes a prior self-installation

Traceability:
- `test_export_subcommand_works`
- `test_plan_subcommand_works`
- `test_doctor_without_page_id_reports_skipped_auth`
- `test_config_shows_not_set_by_default`
- `test_install_subcommand_works`
- `test_uninstall_subcommand_works`

### UX-CLI-002
The help output shall document primary workflows, safety controls, and examples.

Traceability:
- `test_help_does_not_create_output_dirs`
- `test_help_mentions_subcommands_and_safe_mode`
- `test_help_documents_all_public_commands_and_options`

### UX-CLI-003
The CLI shall reject options that do not make sense for the selected command.

Acceptance:
- `install` rejects export-only and safety-only options
- `uninstall` rejects export-only and safety-only options
- `doctor` rejects export-only options
- `config` rejects export-only options
- lifecycle and diagnostic commands reject `--encryption-key` where it does not apply

Traceability:
- `test_install_dir_is_rejected_for_export`
- `test_install_rejects_export_only_options`
- `test_install_rejects_encryption_key`
- `test_uninstall_rejects_export_only_options`
- `test_uninstall_rejects_encryption_key`
- `test_doctor_rejects_export_only_options`
- `test_doctor_rejects_encryption_key`
- `test_config_rejects_export_only_options`
- `test_config_rejects_conflicting_encryption_options`

### UX-CLI-004
`uninstall` shall be idempotent.

Acceptance:
- if an installed binary and library exist, they are removed
- if they do not exist, the command still succeeds and reports that nothing was removed

Traceability:
- `test_uninstall_subcommand_works`
- `test_uninstall_is_idempotent`

### UX-CLI-005
The CLI shall suggest likely intended options for common typos.

Traceability:
- `test_unknown_option_suggestion`

### UX-CLI-006
The CLI shall reject invocations that omit a command.

Traceability:
- `test_missing_command_is_rejected`

## Diagnostic Workflow

### UX-DOC-001
`doctor` without `--page-id` shall validate the local runtime environment and clearly state that auth/access was not checked.

Traceability:
- `test_doctor_without_page_id_reports_skipped_auth`

### UX-DOC-002
`doctor --page-id <id>` shall validate access to that Confluence page and print the resolved title and space.

Traceability:
- `test_doctor_with_page_id_succeeds`

### UX-DOC-003
`doctor --page-id <id>` shall fail clearly when the page is not accessible.

Traceability:
- `test_doctor_with_inaccessible_page_fails`

### UX-DOC-004
The README shall document every public command and every public option that forms part of the CLI contract.

Traceability:
- `test_readme_documents_all_public_commands_and_options`

### UX-DOC-005
The README shall document how to decrypt and extract a GPG-encrypted result.

Traceability:
- `test_readme_documents_gpg_decrypt_flow`

### UX-DOC-006
The CLI shall allow saving, showing, and clearing a default encryption key.

Acceptance:
- `confluex config` shows the current config file path and current default key state
- `confluex config --encryption-key KEY` saves the default key
- `confluex config --clear-encryption-key` clears the saved default key

Traceability:
- `test_config_shows_not_set_by_default`
- `test_config_saves_default_encryption_key`
- `test_config_shows_saved_encryption_key`
- `test_config_clears_default_encryption_key`

## Export Semantics

### FX-EXP-001
The tool shall export the full child tree of the root page.

Traceability:
- `test_basic_export_downloads_tree_and_linked_page`

### FX-EXP-002
The tool shall also export linked pages discovered in page content.

Traceability:
- `test_basic_export_downloads_tree_and_linked_page`
- `test_content_id_only_page_link_is_downloaded`
- `test_mixed_link_forms_are_detected`

### FX-EXP-003
A linked page shall not cause its own descendants to be exported unless they are also part of the root tree or linked independently.

Traceability:
- `test_linked_page_does_not_pull_its_descendants`

### FX-EXP-004
A page shall never be exported more than once per run.

Traceability:
- `test_duplicate_paths_do_not_duplicate_exports`
- `test_same_page_found_through_four_forms_exports_once`
- `test_rediscovered_already_visited_page_is_not_reexported`

### FX-EXP-005
Cycles and self-links shall not cause unbounded processing.

Traceability:
- `test_cycle_links_do_not_loop`
- `test_self_link_does_not_duplicate_page`

## Link Resolution

### FX-LINK-001
The tool shall support internal page discovery via:
- child tree results
- `ri:content-id`
- `ri:page` title links
- macro page parameters
- internal `href` links with `pageId`

Traceability:
- `test_content_id_only_page_link_is_downloaded`
- `test_cross_space_title_link_resolves_correctly`
- `test_page_param_with_colon_space_stays_same_space_title`
- `test_mixed_link_forms_are_detected`

### FX-LINK-002
Ambiguous or invalid title-based links shall not be guessed; they shall remain unresolved.

Traceability:
- `test_ambiguous_title_stays_unresolved`
- `test_candidate_info_title_mismatch_stays_unresolved`
- `test_title_without_space_key_and_unknown_current_space_stays_unresolved`

### FX-LINK-003
External or non-page content that merely looks like an internal link shall not trigger extra downloads.

Traceability:
- `test_external_pageid_like_href_does_not_trigger_download`
- `test_pageid_text_inside_code_blocks_is_ignored`
- `test_children_parser_ignores_non_page_ids`

### FX-LINK-004
Different link forms that resolve to the same target page shall produce only one exported page and one semantic dependency record per source-target pair.

Traceability:
- `test_same_page_found_through_four_forms_exports_once`
- `test_shared_linked_page_from_two_sources_is_exported_once`

## Safety Controls

### UX-SAFE-001
`--safe` shall apply conservative defaults for export limits unless explicitly overridden.

Acceptance:
- default `max-find-candidates=5`
- default `max-pages=200`
- default `max-download-mib=256`
- default `sleep-ms=200`

Traceability:
- `test_safe_mode_applies_default_limits`
- `test_safe_mode_keeps_explicit_overrides`

### UX-SAFE-002
`--max-pages` shall stop processing early after the configured number of processed pages.

Traceability:
- `test_max_pages_stops_early`

### UX-SAFE-003
`--max-download-mib` shall stop processing early after the configured total downloaded volume is reached.

Traceability:
- `test_max_download_mib_stops_early`

### UX-SAFE-004
An explicit `--out` directory shall be rejected if it already exists.

Traceability:
- `test_explicit_output_dir_must_not_exist`

### UX-SAFE-005
Automatically generated output directories shall avoid collisions.

Traceability:
- `test_default_output_dir_avoids_collision`

### UX-SAFE-006
When `--encryption-key` is used for `export` or `plan`, or when a default encryption key is configured, successful completion shall produce an encrypted archive and remove the plain output directory.

Acceptance:
- `<out>.tar.gz.gpg` exists
- `<out>.tar.gz.gpg.txt` exists with decrypt/extract instructions
- `<out>` is removed
- `KEY` is treated as a GPG key identity accepted by `gpg --recipient`
- the documented preferred form is a full fingerprint
- an explicit `--encryption-key` overrides the saved default for the current run

Traceability:
- `test_encryption_key_creates_gpg_archive_and_removes_output_dir`
- `test_plan_can_be_encrypted_and_removes_output_dir`
- `test_configured_encryption_key_is_used_by_default`
- `test_cli_encryption_key_overrides_configured_default`

### UX-SAFE-007
If GPG encryption fails, the plain output directory shall be preserved.

Traceability:
- `test_encryption_key_failure_keeps_plain_output_dir`

## Reporting And Observability

### FX-REP-001
Each successful or partially successful run shall produce report files with consistent semantics:
- `manifest.tsv`
- `resolved-links.tsv`
- `unresolved-links.tsv`
- `failed-pages.tsv`
- `summary.txt`

Traceability:
- `assert_standard_report_files`
- `assert_report_invariants`
- `test_basic_export_reports_match_contract_exactly`

### FX-REP-002
`summary.txt` shall expose enough data to understand what happened operationally.

Acceptance:
- includes mode, command, safety settings, counts, download totals, and completion status

Traceability:
- `test_basic_export_downloads_tree_and_linked_page`
- `test_safe_mode_applies_default_limits`

### FX-REP-003
The summary shall distinguish root, tree, linked, and other processed pages.

Traceability:
- `test_basic_export_downloads_tree_and_linked_page`

### FX-REP-004
Repeated runs with the same input shall yield the same logical reports and the same exported page contents.

Traceability:
- `test_repeated_runs_are_idempotent`

## Metadata And Dry-Run

### FX-META-001
Without `--keep-metadata`, page metadata files shall not persist in output.

Traceability:
- `test_export_default_does_not_persist_metadata_files`
- `test_dry_run_default_does_not_persist_metadata_files`

### FX-META-002
With `--keep-metadata`, page metadata files shall persist in output.

Traceability:
- `test_export_keep_metadata_persists_metadata_files`
- `test_dry_run_keep_metadata`

### FX-META-003
`plan` or `--dry-run` shall not write exported HTML pages or downloaded attachments.

Traceability:
- `test_plan_subcommand_works`
- `test_dry_run_minimal_artifacts`

## Interruption And Failure Semantics

### FX-ERR-001
Fail-fast mode shall stop on the first runtime failure and mark the result as incomplete.

Traceability:
- `test_fail_fast_stops_after_first_page_failure`
- `test_fail_fast_stops_after_edit_failure`
- `test_fail_fast_stops_after_info_failure`

### FX-ERR-002
Best-effort mode shall continue after page-local failures.

Traceability:
- `test_no_fail_fast_continues_after_failure`
- `test_no_fail_fast_continues_after_inaccessible_tree_page`
- `test_no_fail_fast_continues_after_linked_page_info_failure`

### FX-ERR-003
If interrupted during a normal export, the tool shall preserve already written data and mark the run incomplete.

Traceability:
- `test_interrupt_export_marks_incomplete_and_keeps_partial_data`

### FX-ERR-004
If interrupted during a dry-run, the tool shall remove the dry-run output directory.

Traceability:
- `test_interrupt_dry_run_removes_output_dir`

### FX-ERR-005
Partially successful export operations shall be visible in reports rather than being silently treated as success.

Traceability:
- `test_partial_export_failure_is_reported_without_losing_downloaded_html`
