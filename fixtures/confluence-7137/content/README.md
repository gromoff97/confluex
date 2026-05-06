# Confluence 7.13.7 Fixture Bundle

- `manifest.json` owns structure only.
- `macro-inventory.json` owns the intended first-wave built-in macro coverage only.
- `macro-inventory.json` does not change the page tree; it maps built-in macro classes onto existing logical pages.
- Every page body lives in `pages/*.storage.xml`.
- `{{page_id:<logical_name>}}` placeholders are the only supported runtime substitution token.
- Attachments live under `attachments/<logical-page-id>/`.
- Keep ambiguity cases valid on real Confluence: same title across spaces is allowed, same title twice in one space is not.
