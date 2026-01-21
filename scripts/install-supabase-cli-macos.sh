#!/usr/bin/env bash
set -euo pipefail

VERSION="${SUPABASE_CLI_VERSION:-2.72.8}"
ARCH="$(uname -m)"

if [[ "$ARCH" == "arm64" ]]; then
  ASSET="supabase_darwin_arm64.tar.gz"
elif [[ "$ARCH" == "x86_64" ]]; then
  ASSET="supabase_darwin_amd64.tar.gz"
else
  echo "Unsupported architecture: $ARCH" >&2
  exit 1
fi

URL="https://github.com/supabase/cli/releases/download/v${VERSION}/${ASSET}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Downloading Supabase CLI from:"
echo "  $URL"

if ! curl -fL "$URL" -o "$TMP_DIR/supabase.tar.gz"; then
  echo "Download failed. Check your network or GitHub access." >&2
  exit 1
fi

tar -xzf "$TMP_DIR/supabase.tar.gz" -C "$TMP_DIR"

if [[ ! -f "$TMP_DIR/supabase" ]]; then
  echo "Supabase binary not found in the archive." >&2
  exit 1
fi

mkdir -p "$HOME/.local/bin"
cp "$TMP_DIR/supabase" "$HOME/.local/bin/supabase"
chmod +x "$HOME/.local/bin/supabase"

if ! grep -q 'export PATH="$HOME/.local/bin:$PATH"' "$HOME/.zprofile" 2>/dev/null; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zprofile"
  echo "Updated ~/.zprofile to include ~/.local/bin on PATH."
fi

echo "Supabase CLI installed to ~/.local/bin/supabase"
echo "Version:"
"$HOME/.local/bin/supabase" --version
echo "If needed, run: source ~/.zprofile"
