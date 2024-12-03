def prod_archive(
        name,
        archive_name,
        server,
        ui_bundle,
        deps = [],
        tags = [],
        visibility = ["//visibility:public"]):
    """Build macro for generating prod app archives for deployment.

    Args:
      name: Name for the generated build target.
      archive_name: Name (without extension) for the archive file.
      server: Label for entry point target for the backend server.
      ui_bundle: Label for the frontend UI bundle target.
      deps: Additional non-direct dependencies to include in the archive.
      tags: Tags to assign to the generated target.
      visibility: Defaults to public.
    """
    _prod_archive_rule(
        name = name,
        auxiliary_deps = deps + [
            "//:env",
            "//:package_json",
            "//:tsconfig",
        ],
        filename = "{}.zip".format(archive_name),
        server = server,
        ui_bundle = ui_bundle,
        tags = tags + ["app_archive", "manual"],
        visibility = visibility,
    )

def _prod_archive_impl(ctx):
    args = ctx.actions.args()
    args.add("--rootDir", ctx.bin_dir.path)
    args.add("--outFile", ctx.outputs.filename)

    deps = [d for d in ctx.attr.auxiliary_deps]
    deps.extend([ctx.attr.server, ctx.attr.ui_bundle])

    depsets_transitive_files = []
    for dep in deps:
        depsets_transitive_files.append(dep[DefaultInfo].default_runfiles.files)
        depsets_transitive_files.append(dep[DefaultInfo].files)

    outputs = [ctx.outputs.filename]
    ctx.actions.run(
        arguments = [args],
        executable = ctx.executable._archiver_exe,
        inputs = depset(
            transitive = depsets_transitive_files,
        ),
        mnemonic = "AppArchive",
        outputs = outputs,
        progress_message = "[AppArchive] Archiving %{label}",
        tools = [ctx.attr._archiver_exe[DefaultInfo].files_to_run],
    )

    return [
        DefaultInfo(
            files = depset(outputs),
        ),
    ]

_prod_archive_rule = rule(
    attrs = {
        "auxiliary_deps": attr.label_list(
            allow_files = True,
            mandatory = True,
        ),
        "filename": attr.output(
            doc = "Filename for the output archive.",
            mandatory = True,
        ),
        "server": attr.label(
            doc = "The entry point target for the app server.",
            mandatory = True,
        ),
        "ui_bundle": attr.label(
            doc = "The bundle target for the app UI.",
            mandatory = True,
        ),
        "_archiver_exe": attr.label(
            cfg = "exec",
            default = Label("//tools/apps/archiver"),
            executable = True,
        ),
    },
    implementation = _prod_archive_impl,
    provides = [DefaultInfo],
)
