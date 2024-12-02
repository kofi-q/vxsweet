#!/bin/bash

cd "${BUILD_WORKSPACE_DIRECTORY}" || exit 1
bazel run //tools/gazelle:go_tidy_binary
bazel mod tidy
