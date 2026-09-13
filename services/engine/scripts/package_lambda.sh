#!/usr/bin/env sh
# Build the zip artifact for the Python engine Lambda (arm64, NumPy only).
# Usage: scripts/package_lambda.sh [output.zip]
set -eu
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$HERE/build/engine.zip}"
BUILD="$HERE/build/lambda"
rm -rf "$BUILD" && mkdir -p "$BUILD"
python3 -m pip install --quiet --target "$BUILD" --platform manylinux2014_aarch64 \
  --implementation cp --python-version 3.12 --only-binary=:all: "numpy>=2.0"
cp -R "$HERE/engine" "$BUILD/engine"
mkdir -p "$BUILD/fixtures" "$BUILD/contracts"
cp "$HERE/fixtures/company_demo_agency.json" "$BUILD/fixtures/"
cp "$HERE/../../contracts/"*.json "$BUILD/contracts/"
find "$BUILD" -name "__pycache__" -type d -prune -exec rm -rf {} +
mkdir -p "$(dirname "$OUT")"
(cd "$BUILD" && zip -qr "$OUT" .)
echo "$OUT"
