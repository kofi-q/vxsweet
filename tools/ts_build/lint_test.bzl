load("//tools/eslint:eslint_test.bzl", "eslint_test")
load(":files.bzl", "list_all_files")

def lint_test(
        name = "lib",
        data = [],
        size = "small",
        tags = [],
        timeout = None,
        visibility = ["//visibility:public"]):
    """Declares a build target for transpiling Typescript source files in a package.

    Args:
      name: Name for the build target. This should usually match the name of
          the package/directory.
      deps: Source file dependencies, including node_modules dependencies.
      data: Data/script/asset files that are written/read at runtime.
      size: Size tag for the test target - defaults to "small".
      tags: Additional tags to attach to the generated targets.
      timeout: Timeout ("short" | "moderate" | "long" | "eternal") for the
          test target. Default value will correspond to the `size`.
      visibility: Defaults to package-private.
    """

    eslint_test(
        name = name,
        srcs = list_all_files(),
        data = data,
        tags = tags + ["lint"],
        visibility = visibility,
    )
