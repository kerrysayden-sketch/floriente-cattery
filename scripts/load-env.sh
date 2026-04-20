#!/usr/bin/env bash
# Load local dev secrets from macOS Keychain into shell env.
# Usage: source scripts/load-env.sh
# Never stores secrets on disk. Values live only in this shell process.
#
# No-op on CI and non-macOS. On Cloudflare Pages and GitHub Actions the
# platform injects secrets into the build environment directly, so there is
# nothing to pull from Keychain — and the `security` binary does not exist
# on Linux.

set -eu

if [ "${CF_PAGES:-}" = "1" ] || [ -n "${CI:-}" ] || [ "$(uname -s)" != "Darwin" ]; then
  return 0 2>/dev/null || exit 0
fi

kc_read() {
  security find-generic-password -s "$1" -w 2>/dev/null || {
    echo "load-env: Keychain entry '$1' not found." >&2
    echo "  Create it: security add-generic-password -a \"\$USER\" -s '$1' -w '<token>' -U" >&2
    return 1
  }
}

STORYBLOK_TOKEN="$(kc_read 'florientecattery-storyblok-preview')"
export STORYBLOK_TOKEN
