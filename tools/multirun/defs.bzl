load("@bazel_skylib//lib:shell.bzl", "shell")
load("@npm//:tsx/package_json.bzl", tsx = "bin")

def multirun(
        name,
        exe_targets,
        tags = [],
        visibility = None):
    tsx.tsx_binary(
        name = name,
        data = [
            "//tools/multirun",
        ],
        fixed_args = [
            "$(rootpath //tools/multirun)",
        ] + [
            shell.quote("cd $${BUILD_WORKSPACE_DIRECTORY} && bazel run %s" % target)
            for target in exe_targets
        ],
        tags = tags,
        visibility = visibility,
    )
