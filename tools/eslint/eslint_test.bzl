load("@npm//:eslint/package_json.bzl", eslint = "bin")

def eslint_test(
        name,
        srcs,
        data = [],
        tags = [],
        size = "medium",
        timeout = "short",
        **kwargs):
    """Runs eslint checks on the given source files and fails the test if any lint errors are found.

    Args:
      name: Name of the target
      srcs: List of sources to run eslint on.
      data: Optional list of targets needed at runtime.
      size: Size tag for the test target - defaults to "small".
      tags: Additional tags to attach to the generated targets.
      timeout: Timeout ("short" | "moderate" | "long" | "eternal") for the
          test target. Default value will correspond to the `size`.
      **kwargs: Additional arguments to pass to the underlying js_test target.
    """

    eslint.eslint_test(
        name = name,
        args = [
            "-c",
            "$(location //tools/eslint:config.js)",
            "-f",
            "$(location //tools/eslint/formatter:formatter.js)",
            "--color",
        ] + ["$(location %s)" % (s) for s in srcs],
        data = data + srcs + [
            "//tools/eslint/formatter:formatter.js",
            "//tools/eslint/formatter",
            "//tools/eslint:config.js",
            "//tools/eslint",
        ],
        env = {
            "ESLINT_USE_FLAT_CONFIG": "true",
        },
        size = size,
        tags = tags + ["eslint"],
        timeout = timeout,
        **kwargs
    )
