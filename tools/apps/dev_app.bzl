load("//tools/multirun:defs.bzl", "multirun")

def dev_app(name, backend_server, frontend_server, tags = []):
    multirun(
        name = name,
        exe_targets = [
            backend_server,
            frontend_server,
        ],
        tags = tags,
        visibility = ["//visibility:public"],
    )
