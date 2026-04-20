#!/usr/bin/env bash
# Update the Storyblok preview token entry in the macOS Keychain.
#
# Usage:
#   1. Copy the new token from Storyblok (Space Settings -> Access Tokens).
#   2. Run: bash scripts/keychain-set-storyblok.sh
#
# Reads the token from the clipboard via `pbpaste` so the value never
# appears in shell history or on the command line.

set -eu

SERVICE='florientecattery-storyblok-preview'

if ! command -v pbpaste >/dev/null 2>&1; then
  echo "keychain-set-storyblok: pbpaste not found — macOS only script." >&2
  exit 1
fi

TOKEN="$(pbpaste | tr -d '[:space:]')"
LEN=${#TOKEN}

if [ "$LEN" -lt 20 ] || [ "$LEN" -gt 40 ]; then
  echo "Clipboard does not look like a Storyblok token (length=$LEN, expected ~24)." >&2
  echo "Copy the preview token from Storyblok and try again." >&2
  exit 1
fi

security add-generic-password -a "$USER" -s "$SERVICE" -w "$TOKEN" -U

echo "Keychain entry '$SERVICE' updated. length=$LEN first6=${TOKEN:0:6}"
