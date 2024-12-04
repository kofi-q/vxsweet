load("@aspect_rules_js//js:defs.bzl", "js_binary")

def prod_app(
        name,
        backend_src,
        backend_entry_point,
        default_port,
        frontend_bundle,
        static_file_dir,
        vx_machine_type,
        data = [],
        tags = [],
        additional_env_vars = {}):
    js_binary(
        name = name,
        data = data + [
            "//:env",
            backend_src,
            frontend_bundle,
        ],
        entry_point = backend_entry_point,
        env = {
            "BAZEL_BINDIR": ".",
            "NODE_ENV": "production",
            "PLAYWRIGHT_BROWSERS_PATH": "./node_modules/@playwright/browser-chromium",
            "PORT": "$${PORT-%s}" % default_port,
            "STATIC_FILE_DIR": static_file_dir,
            "VX_MACHINE_TYPE": vx_machine_type,
        } | additional_env_vars,
        patch_node_fs = False,
        tags = tags + ["manual", "prod_app"],
        visibility = ["//visibility:public"],
    )
