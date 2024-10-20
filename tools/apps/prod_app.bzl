load("@npm//:tsx/package_json.bzl", tsx = "bin")

def prod_app(
        name,
        backend_src,
        backend_entry_point,
        frontend_bundle,
        vx_machine_type,
        default_port,
        data = [],
        tags = [],
        additional_env_vars = {}):
    tsx.tsx_binary(
        name = name,
        data = data + [
            "//:env",
            backend_entry_point,
            backend_src,
            frontend_bundle,
        ],
        env = {
            "BAZEL_BINDIR": ".",
            "NODE_ENV": "production",
            "PORT": "$${PORT-%s}" % default_port,
            "STATIC_FILE_DIR": "$(rootpath {})".format(frontend_bundle),
            "VX_MACHINE_TYPE": vx_machine_type,
        } | additional_env_vars,
        fixed_args = [
            "$(rootpath {})".format(backend_entry_point),
        ],
        patch_node_fs = False,
        tags = tags,
        visibility = ["//visibility:public"],
    )
