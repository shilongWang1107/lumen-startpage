#!/usr/bin/env bash
# Build a clean, Chrome Web Store-ready zip for LUMEN.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(python3 - <<'PY'
import json
from pathlib import Path
print(json.loads(Path("manifest.json").read_text())["version"])
PY
)"
OUT="dist/lumen-startpage-v${VERSION}.zip"

FILES=(
  manifest.json
  background.js
  index.html
  styles.css
  app.js
  icons/icon16.png
  icons/icon32.png
  icons/icon48.png
  icons/icon128.png
  LICENSE
  PRIVACY.md
)

mkdir -p dist
rm -f "$OUT"

if command -v zip >/dev/null 2>&1; then
  zip -q -X "$OUT" "${FILES[@]}"
else
  python3 - "$OUT" "${FILES[@]}" <<'PY'
import sys
import zipfile

out, *files = sys.argv[1:]
with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in files:
        archive.write(path, path)
PY
fi

echo "Built ${OUT}"
