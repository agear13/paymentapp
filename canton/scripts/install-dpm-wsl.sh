#!/usr/bin/env bash
set -euo pipefail
export PATH="${HOME}/.dpm/bin:${PATH}"
if ! command -v dpm >/dev/null 2>&1; then
  echo "==> Installing dpm via official install.sh"
  curl -fsSL https://get.digitalasset.com/install/install.sh | sh
fi
export PATH="${HOME}/.dpm/bin:${PATH}"
dpm version
echo "==> Installing SDK 3.5.2"
dpm install 3.5.2
dpm version
which dpm
echo "dpm WSL install OK"
