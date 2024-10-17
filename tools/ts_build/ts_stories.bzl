load(":files.bzl", "list_story_files")
load(":ts_transpile.bzl", "ts_transpile")

def ts_stories(
        name,
        deps = [],
        data = [],
        tags = [],
        visibility = ["//visibility:public"]):
    """Declares a build target for all StorybookJS story files in a package.

    Args:
      name: Name for the build target.
      deps: Source file dependencies, including node_modules dependencies.
      data: Data/script/asset files that are written/read at runtime.
      tags: Additional tags to attach to the generated targets.
      visibility: Defaults to public.
    """

    ts_transpile(
        name = name,
        srcs = list_story_files(),
        deps = deps,
        data = data,
        tags = ["stories"],
        visibility = visibility,
    )
