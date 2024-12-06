load("@aspect_rules_jest//jest:defs.bzl", _jest_test = "jest_test")

def jest_test(
        name,
        srcs,
        data,
        size,
        timeout,
        env = {},
        jest_environment = "jsdom",
        shard_count = 1,
        tags = [],
        visibility = None):
    _jest_test(
        name = name,
        args = [
            # Looks like we have a lot of tests with hanging
            # file/event handles:
            "--forceExit",
        ],
        config = "//tools/jest:config.js",
        data = srcs + data + [
            "//tools/jest",
            "//tools/jest:config.js",
        ] + native.glob(
            ["**/__image_snapshots__/**/*.png"],
            allow_empty = True,
        ),
        env = env | {
            "IS_BAZEL_TEST": "true",
            "JEST_ENVIRONMENT": jest_environment,
            "NODE_ENV": "test",
            "PLAYWRIGHT_BROWSERS_PATH": "./node_modules/@playwright/browser-chromium",
            "TMPDIR": "$${TEST_TMPDIR}",
            "TZ": "America/Anchorage",
        },
        size = size,
        shard_count = shard_count,
        node_modules = "//:node_modules",
        snapshots = native.glob(
            ["**/__snapshots__"],
            exclude_directories = 0,
            allow_empty = True,
        ),
        timeout = timeout,
        tags = tags + ["jest", "js", "ts"],
        visibility = visibility,
    )
