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
        unsound_disable_node_fs_patch_for_tests = False,
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
            "//:node_modules/tsx",  # For running any script entry points.
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
            "TMPDIR": "$${TEST_TMPDIR}",
            "TZ": "America/Anchorage",
        },
        size = size,
        shard_count = shard_count,
        node_modules = "//:node_modules",
        patch_node_fs = not unsound_disable_node_fs_patch_for_tests,
        snapshots = native.glob(
            ["**/__snapshots__"],
            exclude_directories = 0,
            allow_empty = True,
        ),
        timeout = timeout,
        tags = ["jest", "js", "ts"],
    )
