#!/usr/bin/env bash

set -euo pipefail

RES_TO_TS_PATH_ABSOLUTE="${PWD}/${RES_TO_TS_PATH}"

cd "${BUILD_WORKSPACE_DIRECTORY}/libs/fixtures"

find src/data -type f -not -name index.ts -not -name "election*.json*" -exec rm {} \;
${RES_TO_TS_PATH_ABSOLUTE} --rootDir data --outDir src/data \
    'data/**/*.{csv,jpeg,jpg,json,jsonl,pdf,png,txt,xml,zip}' \
    '!data/**/castVoteRecords/**/*.{csv,jpeg,jpg,json,jsonl,pdf,png,txt,xml,zip}' \
    'data/**/castVoteRecords'
