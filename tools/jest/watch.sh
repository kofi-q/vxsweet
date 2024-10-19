#!/usr/bin/env bash

#
# Meant to be run via `bazel run //tools/jest:watch <test_file_pattern>`
#

set -euo pipefail


if [ $# -lt 1 ]; then
  echo -e "\033[31mError: At least one argument is required.\033[0m" >&2
  exit 1
fi

BINARY_PATH_ABS="${PWD}/${BINARY_PATH}"
CONFIG_PATH_ABS="${BUILD_WORKSPACE_DIRECTORY}/jest.config.js"

cd "${BUILD_WORKING_DIRECTORY}"
export TZ="America/Anchorage"
export NODE_ENV="test"

exec ${BINARY_PATH_ABS} --config="${CONFIG_PATH_ABS}" --watch --forceExit "${@-'.'}"
