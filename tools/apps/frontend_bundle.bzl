load("@aspect_rules_js//js:providers.bzl", "JsInfo")
load("@bazel_skylib//rules:copy_file.bzl", "copy_file")

ASSET_FILE_EXTENSIONS = [
    "css",
    "ico",
    "js",
    "svg",
    "txt",
    "woff2",
]

def frontend_bundle(
        name,
        srcs,
        entry_point,
        index_html_path,
        static_asset_dir,
        tags = [],
        visibility = ["//visibility:public"]):
    """Declares a build target for generating a UI JS bundle along with related assets.

    Args:
      name: Name for the generated build target.
      srcs: Build target label(s) for the UI code containing the entry point.
      entry_point: Path to the JS entry point for the app bundle.
      index_html_path: Path to the .html entry point for the app.
      static_asset_dir: Path to the directory containing assets to include in the output.
      tags: Tags to assign to the generated target.
      visibility: Defaults to public.
    """
    ASSET_FILES = native.glob(
        [
            "{}/**/*.{}".format(static_asset_dir, ext)
            for ext in ASSET_FILE_EXTENSIONS
        ],
        allow_empty = True,
    )

    # [TODO] Use a genrule instead and do a batch copy:
    asset_labels = []
    for asset in ASSET_FILES:
        asset_path = asset.removeprefix(static_asset_dir + "/")
        asset_label = "asset_{}".format(asset_path)
        asset_labels.append(asset_label)
        copy_file(
            name = asset_label,
            src = asset,
            out = "build/{}".format(asset_path),
        )

    _ui_bundle_rule(
        name = name,
        assets = asset_labels,
        entry_point = entry_point,
        index_html = index_html_path,
        package_root = native.package_name(),
        srcs = srcs + [
            "//:node_modules/assert",
            "//:node_modules/browserify-zlib",
            "//:node_modules/buffer",
            "//:node_modules/events",
            "//:node_modules/pagedjs",
            "//:node_modules/path",
            "//:node_modules/stream-browserify",
            "//:node_modules/util",
            "//:env",
            "//libs/browser-stubs",
        ],
        tags = tags + ["bundle"],
        visibility = visibility,
    )

def _ui_bundle_impl(ctx):
    asset_path_index_js = "/assets/index.js"
    out_index_js = ctx.actions.declare_file(
        "build{}".format(asset_path_index_js),
    )
    out_index_html = ctx.actions.declare_file("build/index.html")

    esbuild_args = ctx.actions.args()
    esbuild_args.add("--rootDir", ctx.bin_dir.path)
    esbuild_args.add("--packageRootDir", ctx.attr.package_root)
    esbuild_args.add("--entryPoint", ctx.file.entry_point.short_path)
    esbuild_args.add("--indexHtml", ctx.file.index_html.short_path)
    esbuild_args.add("--outJsBundle", out_index_js.short_path)
    esbuild_args.add("--urlJsBundle", asset_path_index_js)
    esbuild_args.add("--outHtml", out_index_html.path)

    depsets_transitive_srcs = []
    for dep in ctx.attr.srcs:
        if JsInfo in dep:
            depsets_transitive_srcs.append(dep[JsInfo].transitive_sources)
            depsets_transitive_srcs.append(dep[JsInfo].npm_sources)

    outputs = [out_index_html, out_index_js]
    ctx.actions.run(
        arguments = [esbuild_args],
        executable = ctx.executable._esbuild_exe,
        inputs = depset(
            [ctx.file.entry_point, ctx.file.index_html],
            transitive = depsets_transitive_srcs,
        ),
        mnemonic = "UiBundle",
        outputs = outputs,
        progress_message = "[UiBundle] Bundling %{label}",
        tools = [ctx.attr._esbuild_exe[DefaultInfo].files_to_run],
    )

    return [
        DefaultInfo(
            files = depset(outputs),
            runfiles = ctx.runfiles(ctx.files.assets),
        ),
    ]

_ui_bundle_rule = rule(
    attrs = {
        "assets": attr.label_list(
            allow_files = True,
            doc = "Files needed at runtime (e.g. static assets)",
        ),
        "entry_point": attr.label(
            allow_single_file = True,
            doc = "The entry point source file.",
            mandatory = True,
            providers = [JsInfo],
        ),
        "index_html": attr.label(
            allow_single_file = True,
            doc = "Path to index.html",
            mandatory = True,
        ),
        "package_root": attr.string(
            doc = "Repo-relative path to the root of the app package.",
            mandatory = True,
        ),
        "srcs": attr.label_list(
            allow_files = True,
            doc = """
              Source file targets needed for the entry point to the bundle.
            """,
            mandatory = True,
        ),
        "_esbuild_exe": attr.label(
            cfg = "exec",
            default = Label("//tools/esbuild/bundle"),
            executable = True,
        ),
    },
    implementation = _ui_bundle_impl,
    provides = [DefaultInfo],
)
