def dev_backend(
        name,
        backend_entry_point_from_root,
        backend_path_from_root,
        vx_machine_type,
        data = [],
        port = None):
    native.sh_binary(
        name = name,
        srcs = ["//tools/apps:run_dev_backend.sh"],
        data = data + [
            "//:env",
            "//tools/tsx:cli",
        ],
        env = {
            "BACKEND_ENTRY_POINT": backend_entry_point_from_root,
            "BACKEND_PATH": backend_path_from_root,
            "NODE_ENV": "development",
            "PORT": port,
            "TSX_PATH": "$(rootpath //tools/tsx:cli)",
            "VX_MACHINE_TYPE": vx_machine_type,
        },
        tags = ["manual"],
        visibility = ["//visibility:public"],
    )
