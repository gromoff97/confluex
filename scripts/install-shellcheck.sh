#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="$ROOT_DIR/tools/shellcheck"
VERSION="${SHELLCHECK_VERSION:-v0.11.0}"
ARCHIVE="shellcheck-${VERSION}.linux.x86_64.tar.xz"
DOWNLOAD_URL="https://github.com/koalaman/shellcheck/releases/download/${VERSION}/${ARCHIVE}"
TMP_DIR="$TOOLS_DIR/tmp"

mkdir -p "$TOOLS_DIR" "$TMP_DIR"
curl -fsSL "$DOWNLOAD_URL" -o "$TMP_DIR/$ARCHIVE"
tar -xf "$TMP_DIR/$ARCHIVE" -C "$TMP_DIR"
install -m 755 "$TMP_DIR/shellcheck-${VERSION}/shellcheck" "$TOOLS_DIR/shellcheck"

printf 'Installed ShellCheck %s to %s\n' "$VERSION" "$TOOLS_DIR/shellcheck"
