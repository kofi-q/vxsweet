#!/usr/bin/env bash

set -euo pipefail

PNPM_PATH_ABS="${PWD}/${PNPM_PATH}"

cd "${BUILD_WORKSPACE_DIRECTORY}" || exit 1

echo
echo "📦 Installing IDE-facing npm packages..."
${PNPM_PATH_ABS} --dir "${BUILD_WORKSPACE_DIRECTORY}" install --frozen-lockfile --ignore-scripts || exit 1

echo
echo "🧹 Building ESLint rules and config..."
bazel build //tools/eslint

echo
echo "🛠️  Building BUILD file management tools..."
bazel build @rules_go//go
bazel build //:tidy

echo
echo "💚 Done"
