load(":files.bzl", "list_source_files")
load(":ts_transpile.bzl", "ts_transpile")

def ts_library(
        name = "lib",
        deps = [],
        data = [],
        tags = [],
        visibility = None):
    """Declares a build target for transpiling Typescript source files in a package.

    Args:
      name: Name for the build target. This should usually match the name of
          the package/directory.
      deps: Source file dependencies, including node_modules dependencies.
      data: Data/script/asset files that are written/read at runtime.
      tags: Additional tags to attach to the generated targets.
      visibility: Defaults to package-private.
    """

    ts_transpile(
        name = name,
        srcs = list_source_files(),
        deps = deps,
        data = data,
        tags = tags + ["src"],
        visibility = visibility,
    )
