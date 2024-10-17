load("@aspect_rules_ts//ts:defs.bzl", "ts_project")

def ts_transpile(
        name,
        srcs,
        deps,
        data = [],
        tags = [],
        visibility = ["//visibility:public"]):
    """Declares a build target for transpiling Typescript files to JS.

    Args:
      name: Name for the generated build target.
      srcs: Typescript source files.
      data: Data files needed at runtime.
      deps: Imported dependencies for this package, including node_modules dependencies.
      tags: Additional tags to attach to the generated targets.
      visibility: Defaults to package private.
    """

    ts_project(
        name = name,
        srcs = srcs,
        allow_js = True,
        data = data,
        declaration = True,
        declaration_map = True,
        incremental = True,
        preserve_jsx = False,
        resolve_json_module = True,
        transpiler = "tsc",
        tags = tags + ["js", "ts"],
        tsconfig = "//:tsconfig",
        visibility = visibility,
        deps = deps,
    )
