load(
    "@aspect_bazel_lib//lib:copy_to_bin.bzl",
    "COPY_FILE_TO_BIN_TOOLCHAINS",
    "copy_file_to_bin_action",
)
load("@aspect_rules_js//js:providers.bzl", "JsInfo")

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
    outputs_js = []
    outputs_dts = []
    outputs_dts_map = []
    for src in srcs:
        if src.endswith(".d.ts"):
            continue

        if src.endswith("js"):
            continue

        idx_extension = src.rindex(".")
        outputs_js.append(src[:idx_extension] + ".js")
        outputs_dts.append(src[:idx_extension] + ".d.ts")
        outputs_dts_map.append(src[:idx_extension] + ".d.ts.map")

    _ts_transpile_rule(
        name = name,
        data = data,
        deps = deps,
        outputs_js = outputs_js,
        outputs_dts = outputs_dts,
        outputs_dts_map = outputs_dts_map,
        srcs = srcs,
        tags = tags + ["js", "ts"],
        visibility = visibility,
    )

def _ts_transpile_impl(ctx):
    tsc_args = ctx.actions.args()
    tsc_args.set_param_file_format("multiline")
    tsc_args.use_param_file("@%s", use_always = True)

    inputs_srcs = []
    outputs_transpiled = []
    outputs_srcs = []
    outputs_types = []
    outputs_noop = []

    for src in ctx.files.srcs:
        extension = ".{}".format(src.extension)
        src_without_extension = src.basename.removesuffix(extension)
        js_filename = "{}.js".format(src_without_extension)
        dts_filename = "{}.d.ts".format(src_without_extension)
        dts_map_filename = "{}.d.ts.map".format(src_without_extension)

        if src.path.endswith(".d.ts"):
            type_output = copy_file_to_bin_action(ctx, src)
            inputs_srcs.append(type_output)
            outputs_types.append(type_output)
            outputs_noop.append(type_output)
            continue

        if extension == ".ts" or extension == ".tsx":
            inputs_srcs.append(src)
            tsc_args.add(src.path)

            js = ctx.actions.declare_file(js_filename, sibling = src)
            outputs_transpiled.append(js)
            outputs_srcs.append(js)

            dts = ctx.actions.declare_file(dts_filename, sibling = src)
            outputs_transpiled.append(dts)
            outputs_types.append(dts)

            dts_map = ctx.actions.declare_file(dts_map_filename, sibling = src)
            outputs_transpiled.append(dts_map)
            outputs_types.append(dts_map)

            continue

        no_op_src_output = copy_file_to_bin_action(ctx, src)
        inputs_srcs.append(no_op_src_output)
        outputs_noop.append(no_op_src_output)
        outputs_srcs.append(no_op_src_output)

    inputs_transitive_srcs_types = []
    depsets_transitive_files = [depset(outputs_srcs)]
    depsets_transitive_npm_srcs = []
    depsets_transitive_npm_store_infos = []
    depsets_transitive_srcs = []
    depsets_transitive_types = []
    runfile_sets_transitive = []
    for dep in ctx.attr.deps:
        runfile_sets_transitive.append(dep[DefaultInfo].default_runfiles)

        depsets_transitive_srcs.append(dep[JsInfo].transitive_sources)
        depsets_transitive_files.append(dep[JsInfo].transitive_sources)

        inputs_transitive_srcs_types.append(dep[JsInfo].transitive_types)
        depsets_transitive_types.append(dep[JsInfo].transitive_types)

        inputs_transitive_srcs_types.append(dep[JsInfo].npm_sources)
        depsets_transitive_npm_srcs.append(dep[JsInfo].npm_sources)
        depsets_transitive_files.append(dep[JsInfo].npm_sources)

        depsets_transitive_npm_store_infos.append(
            dep[JsInfo].npm_package_store_infos,
        )

    for data_dep in ctx.attr.data:
        depsets_transitive_files.append(data_dep[DefaultInfo].files)
        runfile_sets_transitive.append(data_dep[DefaultInfo].default_runfiles)

        if JsInfo in data_dep:
            depsets_transitive_files.append(
                data_dep[JsInfo].transitive_sources,
            )
            depsets_transitive_files.append(
                data_dep[JsInfo].npm_sources,
            )
            depsets_transitive_npm_store_infos.append(
                data_dep[JsInfo].npm_package_store_infos,
            )

    if outputs_transpiled:
        ctx.actions.run(
            arguments = [tsc_args],
            env = {
                "BAZEL_BINDIR": ctx.bin_dir.path,
            },
            executable = ctx.executable._worker_exe,
            execution_requirements = {
                "supports-workers": "1",
            },
            inputs = depset(
                inputs_srcs,
                transitive = inputs_transitive_srcs_types,
            ),
            mnemonic = "TSBuild",
            outputs = outputs_transpiled,
            progress_message = "[TSBuild] Transpiling & Typechecking %{label}",
            tools = [ctx.attr._worker_exe[DefaultInfo].files_to_run],
        )

    runfiles = ctx.runfiles(
        ctx.files.data,
        transitive_files = depset(transitive = depsets_transitive_files),
    ).merge_all(runfile_sets_transitive)

    return [
        DefaultInfo(
            files = depset(outputs_srcs),
            runfiles = runfiles,
        ),
        JsInfo(
            npm_sources = depset(
                transitive = depsets_transitive_npm_srcs,
            ),
            npm_package_store_infos = depset(
                transitive = depsets_transitive_npm_store_infos,
            ),
            sources = depset(outputs_srcs),
            target = ctx.label,
            transitive_sources = depset(
                outputs_srcs,
                transitive = depsets_transitive_srcs,
            ),
            transitive_types = depset(
                outputs_types,
                transitive = depsets_transitive_types,
            ),
            types = depset(outputs_types),
        ),
    ]

_ts_transpile_rule = rule(
    attrs = {
        "srcs": attr.label_list(
            allow_files = True,
            doc = """
              JS/TS source files - TS files are transpiles, JS files are
              propagated without modification.
            """,
        ),
        "deps": attr.label_list(
            allow_files = True,
            doc = """
              Source file dependencies needed at build time.
              (i.e. imports/requires)
            """,
            providers = [JsInfo],
        ),
        "data": attr.label_list(
            allow_files = True,
            doc = "Files needed at runtime (i.e. by fs.readFile/cp/etc)",
        ),
        "outputs_js": attr.output_list(
            doc = "Expected .js output filenames.",
        ),
        "outputs_dts": attr.output_list(
            doc = "Expected .d.ts output filenames.",
        ),
        "outputs_dts_map": attr.output_list(
            doc = "Expected .d.ts.map output filenames.",
        ),
        "_worker_exe": attr.label(
            cfg = "target",
            default = Label("//tools/ts_build/worker:exe"),
            executable = True,
        ),
    },
    implementation = _ts_transpile_impl,
    provides = [DefaultInfo, JsInfo],
    toolchains = COPY_FILE_TO_BIN_TOOLCHAINS,
)
