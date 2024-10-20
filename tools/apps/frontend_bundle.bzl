load("@npm//:tsx/package_json.bzl", tsx = "bin")

ASSET_FILE_EXTENSIONS = [
    "css",
    "ico",
    "js",
    "svg",
    "txt",
    "woff2",
]

def frontend_bundle(name, srcs, index_html_path, static_asset_dir, tags = []):
    ASSET_FILES = [index_html_path] + native.glob(
        [
            "{}/**/*.{}".format(static_asset_dir, ext)
            for ext in ASSET_FILE_EXTENSIONS
        ],
        allow_empty = True,
    )

    tsx.tsx(
        name = name,
        srcs = srcs + ASSET_FILES + [
            "//:env",
            "//:tsconfig_base",
            "//:node_modules/vite/dir",
            "//tools/vite",
            "//tools/vite:config.js",
        ],
        args = [
            "$(rootpath //:node_modules/vite/dir)/bin/vite.js",
            "build",
            "-c",
            "$(rootpath //tools/vite:config.js)",
            native.package_name(),
        ],
        env = {
            "NODE_ENV": "production",
        },
        out_dirs = ["build"],
        tags = tags + ["manual"],
        visibility = ["//visibility:public"],
    )
