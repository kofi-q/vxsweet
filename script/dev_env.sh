#!/usr/bin/env bash

set -euo pipefail

PNPM_PATH_ABS="${PWD}/${PNPM_PATH}"

cd "${BUILD_WORKSPACE_DIRECTORY}" || exit 1

echo
echo "📦 Installing IDE-facing npm packages..."
${PNPM_PATH_ABS} --dir "${BUILD_WORKSPACE_DIRECTORY}" install --frozen-lockfile --ignore-scripts || exit 1

echo
echo "🛠️  Building IDE tools and warming up build tool cache..."
bazel build \
  @rules_go//go \
  //:tidy \
  //tools/esbuild/... \
  //tools/eslint \
  //tools/ts_build/...

echo
echo "💚 Done"
