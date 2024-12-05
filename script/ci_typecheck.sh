#!/usr/bin/env bash

set -euo pipefail

PNPM_PATH_ABS="${PWD}/${PNPM_PATH}"
TSC_PATH_ABS="${PWD}/${TSC_PATH}"

cd "${BUILD_WORKSPACE_DIRECTORY}" || exit 1

echo
echo "Installing npm packages..."
${PNPM_PATH_ABS} --dir "${BUILD_WORKSPACE_DIRECTORY}" install --frozen-lockfile --ignore-scripts || exit 1

echo
echo "Running typecheck..."
${TSC_PATH_ABS} -p ./tsconfig.json || exit 1

echo
echo "✅  Done"
