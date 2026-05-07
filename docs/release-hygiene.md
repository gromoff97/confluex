# Release Hygiene Checklist

Run these checks before pushing or publishing a release candidate.

## Required Checks

```bash
npm run lint
npm run typecheck
npm run build
npm run test
npm pack --dry-run --json
```

The package dry-run must match the public package inventory from
`docs/FR-LIFE.md`:

- `package.json`
- `README.md`
- `LICENSE`
- `bin/confluex.js`
- generated public runtime files under `dist/`

The allowed public docs inventory is exactly `README.md` and `LICENSE` for this
lifecycle target. Content outside this inventory is release-blocking when it is
a development-only dependency folder, test or fixture asset, build scratch
output, internal source tree, or agent instruction file.

## Forbidden Reference Scan

Search current content for local machine paths, user-specific workspace paths,
and internal agent/tooling references. Use the concrete local values for the
machine doing the release check:

```bash
rg -n -i "<linux-home-path>|<windows-home-path>|<ide-workspace-segment>|<agent-dir-marker>" . \
  -g '!node_modules' -g '!dist'
```

Search Git history before publication:

```bash
git grep -I -l -i \
  -e "<linux-home-path>" \
  -e "<windows-home-path>" \
  -e "<ide-workspace-segment>" \
  -e "<agent-dir-marker>" \
  $(git rev-list --all) -- . 2>/dev/null
```

If history contains forbidden references, stop before publication. Rewriting
history requires explicit approval for the publication-hygiene phase.

## Secret And Binary Scan

Search content patterns:

```bash
rg -n -i "password|token|secret|Authorization|PRIVATE KEY|BEGIN RSA|BEGIN OPENSSH" . \
  -g '!node_modules' -g '!dist'
```

Search suspicious historical filenames:

```bash
git log --all --name-only --pretty=format: \
  | rg -i "secret|token|key|private|jar|pdf|zip|tgz" \
  | sort -u
```

Allowed findings are documentation examples, test placeholders, synthetic
fixture PDFs, and ZIP implementation files. Any real credential, license key,
private key, product token, or non-fixture binary is a publication blocker.
