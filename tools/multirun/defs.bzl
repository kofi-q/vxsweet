load("@bazel_skylib//lib:shell.bzl", "shell")
load("@npm//:tsx/package_json.bzl", tsx = "bin")

def multirun(
        name,
        exe_targets,
        watch = False,
        tags = [],
        visibility = None):
    """Runs the given executable targets in `exe_targets` concurrently.

    Args:
      name: Name for the generated run target.
      exe_targets: Labels for executable Bazel targets to run.
      watch: When True, targets will be rebuilt and rerun when relevant files are modified.
      tags: Tags to assign to the generated target.
      visibility: Defaults to public.
    """
    cmd_template = "bazel run %s"
    if watch:
        cmd_template = "bazel run //:watch run %s"

    cmd_template = "cd $${BUILD_WORKSPACE_DIRECTORY} && " + cmd_template

    tsx.tsx_binary(
        name = name,
        data = [
            "//tools/multirun",
        ],
        fixed_args = [
            "$(rootpath //tools/multirun)",
        ] + [
            shell.quote(cmd_template % target)
            for target in exe_targets
        ],
        tags = tags,
        visibility = visibility,
    )
