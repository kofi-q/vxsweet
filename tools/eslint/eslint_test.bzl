def _eslint_test_impl(ctx):
    args = ctx.actions.args()

    out = ctx.actions.declare_file("{}.lint.log".format(ctx.label.name))
    args.add("--outputPath")
    args.add(out)
    args.add_all(ctx.files.srcs)

    args.set_param_file_format("multiline")
    args.use_param_file("@%s", use_always = True)

    ctx.actions.run(
        arguments = [args],
        executable = ctx.executable._worker_exe,
        execution_requirements = {
            "supports-workers": "1",
        },
        inputs = ctx.files.srcs,
        mnemonic = "ESLint",
        progress_message = "[ESLint] Generating lint results for %{label}",
        outputs = [out],
        tools = [ctx.attr._worker_exe[DefaultInfo].files_to_run],
    )

    checker = ctx.actions.declare_file("{}.test.sh".format(ctx.label.name))
    ctx.actions.expand_template(
        template = ctx.file._checker_script_template,
        output = checker,
        substitutions = {
            "{{LINT_LOG}}": out.short_path,
        },
        is_executable = True,
    )

    return [
        DefaultInfo(
            files = depset([out]),
            executable = checker,
            runfiles = ctx.runfiles([out]),
        ),
    ]

eslint_test = rule(
    attrs = {
        "srcs": attr.label_list(
            allow_files = True,
            doc = "Source files to lint",
        ),
        "data": attr.label_list(
            allow_files = True,
            doc = "Files needed at runtimes",
        ),
        "_checker_script_template": attr.label(
            allow_single_file = True,
            default = Label("//tools/eslint:checker.sh.template"),
        ),
        "_worker_exe": attr.label(
            cfg = "target",
            default = Label("//tools/eslint/worker:exe"),
            executable = True,
        ),
    },
    implementation = _eslint_test_impl,
    test = True,
)
