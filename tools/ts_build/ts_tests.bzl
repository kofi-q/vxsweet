load(":files.bzl", "list_test_files")
load(":ts_transpile.bzl", "ts_transpile")

def ts_tests(
        name,
        data = [],
        deps = [],
        env = {},
        num_shards = 1,
        size = "small",
        tags = [],
        timeout = "short",
        type = None,
        unsound_disable_node_fs_patch_for_tests = False,
        visibility = ["//visibility:public"]):
    """Declares build and test targets for Typescript test files in a package.

    Args:
      name: Name for the main source target.

      data: Data/script/asset files written/read to/from by the tests.

      deps: Test file dependencies, including node_modules dependencies.

      env: Additional environment variables to set for the test target.

      num_shards: Defaults to 1. Allows Bazel to split test files across
          multiple workers in parallel. Similar to adjusting test workers with
          jest, but resource management happens across all packages. Consider
          splitting packages into smaller chunks before resorting to sharding
          tests.

      size: Size tag for the test target - defaults to "small".

      skip_all: Skip all tests in this package. For local development only.

      tags: Additional tags to attach to the generated targets.

      timeout: Timeout ("short" | "moderate" | "long" | "eternal") for the
          test target. Default value will correspond to the `size`.

      type: Jest test env ("jsdom" | "node"). Defaults to "jsdom" if .tsx
          files are included, else "node".

      unsound_disable_node_fs_patch_for_tests: Disables node:fs patching that's
          put in place to prevent tests from accessing files outside of the
          sandbox and breaking hermeticity. Useful for any tests that rely on
          specific behaviour that may be modified by the patches.

      visibility: Defaults to public.
    """

    # TODO: Add jest test target
    ts_transpile(
        name = name,
        srcs = list_test_files(),
        deps = deps,
        data = data,
        tags = tags + ["test_files"],
        visibility = visibility,
    )
