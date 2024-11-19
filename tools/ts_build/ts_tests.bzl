load("//tools/jest:jest_test.bzl", "jest_test")
load(":files.bzl", "list_test_files")
load(":ts_transpile.bzl", "ts_transpile")

def ts_tests(
        name,
        data = [],
        deps = [],
        env = {},
        jest_environment = None,
        shard_count = 1,
        size = "medium",
        skip = False,
        tags = [],
        timeout = "short",
        visibility = None):
    """Declares build and test targets for Typescript test files in a package.

    Args:
      name: Name for the main source target.

      data: Data/script/asset files written/read to/from by the tests.

      deps: Test file dependencies, including node_modules dependencies.

      env: Additional environment variables to set for the test target.

      jest_environment: Jest test env ("jsdom" | "node"). Defaults to "jsdom" if .tsx
          files are included, else "node".

      shard_count: Defaults to 1. Allows Bazel to split test files across
          multiple workers in parallel. Similar to adjusting test workers with
          jest, but resource management happens across all packages. Consider
          splitting packages into smaller chunks before resorting to sharding
          tests.

      size: Size tag for the test target - defaults to "small".

      skip: Skip all tests in this package. For local development/manual tests only.

      tags: Additional tags to attach to the generated targets.

      timeout: Timeout ("short" | "moderate" | "long" | "eternal") for the
          test target. Default value will correspond to the `size`.

      visibility: Defaults to public.
    """

    lib_name = "{}_lib".format(name)

    fallback_jest_env = "node"
    if "//:node_modules/react" in deps:
        fallback_jest_env = "jsdom"

    if not skip:
        jest_test(
            name = name,
            srcs = [
                ":{}".format(lib_name),
            ],
            data = [],
            env = env,
            jest_environment = jest_environment or fallback_jest_env,
            shard_count = shard_count,
            size = size,
            timeout = timeout,
            tags = tags,
            visibility = visibility,
        )

    ts_transpile(
        name = lib_name,
        srcs = list_test_files(),
        deps = deps,
        data = data,
        tags = tags + ["test_lib"],
        visibility = visibility,
    )
