def dev_frontend(name, frontend_path_from_root, port, port_backend):
    native.sh_binary(
        name = name,
        srcs = ["//tools/apps:run_dev_frontend.sh"],
        data = [
            "//:env",
            "//tools/vite:cli",
            "//tools/vite:config.js",
        ],
        env = {
            "CONFIG_PATH": "$(rootpath //tools/vite:config.js)",
            "DEV_BACKEND_PORT": port_backend,
            "FRONTEND_PATH": frontend_path_from_root,
            "NODE_ENV": "development",
            "PORT": port,
            "RUN_IN_WORKSPACE": "true",
            "SHOULD_EMPTY_OUT_DIR": "true",
            "VITE_PATH": "$(rootpath //tools/vite:cli)",
        },
        tags = ["manual"],
        visibility = ["//visibility:public"],
    )
