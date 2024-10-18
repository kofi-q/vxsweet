#!/usr/bin/env bash

set -euo pipefail

BINARY_PATH_ABS="${PWD}/${BINARY_PATH}"

cd "${BUILD_WORKSPACE_DIRECTORY}"

exec ${BINARY_PATH_ABS} --fix --color "${@-'.'}"
