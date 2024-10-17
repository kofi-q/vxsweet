load("@aspect_rules_js//js:defs.bzl", "js_library")

def json_package(
        name,
        tags = [],
        visibility = ["//visibility:public"]):
    """Declares a build target for a JSON package importable by  `ts_package` targets.

    Args:
      name: Name for the generated build target.
      tags: Optional additional tags to attach to the generated.
      visibility: Defaults to public.
    """

    js_library(
        name = name,
        srcs = native.glob(
            ["**/*.json"],
            allow_empty = True,
        ),
        tags = tags + ["json"],
        visibility = visibility,
    )
