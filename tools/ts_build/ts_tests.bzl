load("//tools/jest:jest_test.bzl", "jest_test")
load(":files.bzl", "list_test_files")
load(":ts_transpile.bzl", "ts_transpile")

def ts_tests(
        name,
        data = [],
        deps = [],
        env = {},
        shard_count = 1,
        size = "small",
        tags = [],
        timeout = None,
        jest_environment = None,
        tmp_enable_tests = False,
        unsound_disable_node_fs_patch_for_tests = False,
        visibility = None):
    """Declares build and test targets for Typescript test files in a package.

    Args:
      name: Name for the main source target.

      data: Data/script/asset files written/read to/from by the tests.

      deps: Test file dependencies, including node_modules dependencies.

      env: Additional environment variables to set for the test target.

      shard_count: Defaults to 1. Allows Bazel to split test files across
          multiple workers in parallel. Similar to adjusting test workers with
          jest, but resource management happens across all packages. Consider
          splitting packages into smaller chunks before resorting to sharding
          tests.

      size: Size tag for the test target - defaults to "small".

      skip_all: Skip all tests in this package. For local development only.

      tags: Additional tags to attach to the generated targets.

      timeout: Timeout ("short" | "moderate" | "long" | "eternal") for the
          test target. Default value will correspond to the `size`.

      jest_environment: Jest test env ("jsdom" | "node"). Defaults to "jsdom" if .tsx
          files are included, else "node".

      tmp_enable_tests: Temporary flag to enable tests, so tests can be enabled
          when they're passing. TODO: Remove once all tests are fixed.

      unsound_disable_node_fs_patch_for_tests: Disables node:fs patching that's
          put in place to prevent tests from accessing files outside of the
          sandbox and breaking hermeticity. Useful for any tests that rely on
          specific behaviour that may be modified by the patches.

      visibility: Defaults to public.
    """

    TEST_FILES = list_test_files()
    lib_name = "{}_lib".format(name)

    fallback_jest_env = "node"
    if "//:node_modules/react" in deps:
        fallback_jest_env = "jsdom"

    if tmp_enable_tests:
        jest_test(
            name = name,
            srcs = TEST_FILES,
            data = [
                ":{}".format(lib_name),
            ],
            env = env,
            jest_environment = jest_environment or fallback_jest_env,
            shard_count = shard_count,
            size = size,
            timeout = timeout,
            tags = tags,
            unsound_disable_node_fs_patch_for_tests = unsound_disable_node_fs_patch_for_tests,
            visibility = visibility,
        )

    ts_transpile(
        name = lib_name,
        srcs = TEST_FILES,
        deps = deps,
        data = data,
        tags = tags + ["test_lib"],
        visibility = visibility,
    )
