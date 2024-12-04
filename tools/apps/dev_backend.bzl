load("@aspect_rules_js//js:defs.bzl", "js_binary")

def dev_backend(
        name,
        backend_src,
        backend_entry_point,
        default_port,
        vx_machine_type,
        data = [],
        tags = [],
        additional_env_vars = {}):
    js_binary(
        name = name,
        data = data + [
            "//:env",
            "//:env_local",
            backend_src,
        ],
        entry_point = backend_entry_point,
        env = {
            "BAZEL_BINDIR": ".",
            "NODE_ENV": "development",
            "PLAYWRIGHT_BROWSERS_PATH": "./node_modules/@playwright/browser-chromium",
            "PORT": "$${PORT-%s}" % default_port,
            "VX_MACHINE_TYPE": vx_machine_type,
        } | additional_env_vars,
        patch_node_fs = False,
        tags = tags + ["dev_backend", "manual"],
        visibility = ["//visibility:public"],
    )
