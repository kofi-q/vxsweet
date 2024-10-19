# load("@aspect_rules_js//js:defs.bzl", _js_binary = "js_binary")

# def js_exe(
#         name,
#         src,
#         entry_point,
#         data = [],
#         fixed_args = [],
#         visibility = None):
#     _js_binary(
#         name = name,
#         data = data + [
#             src,
#             "//:node_modules/tsx",
#             "//:tsconfig_base",
#         ],
#         entry_point = entry_point,
#         node_options = [
#             # Run with `tsx` to enable tsconfig-path-based import resolution and
#             # `esbuild`-based runtime transpilation, when needed.
#             "--import",
#             "tsx",
#         ],
#         visibility = visibility,
#     )

load("@npm//:tsx/package_json.bzl", tsx = "bin")

def js_exe(
        name,
        src,
        entry_point,
        env = {},
        data = [],
        fixed_args = [],
        tags = [],
        visibility = None):
    tsx.tsx_binary(
        name = name,
        data = data + [
            "//:tsconfig_base",
            entry_point,
            src,
        ],
        env = env | {
            "BAZEL_BINDIR": ".",
            "NODE_ENV": "production",
            "YES": "NO",
        },
        fixed_args = [
            "$(rootpath {})".format(entry_point),
        ] + fixed_args,
        patch_node_fs = False,
        tags = tags,
        visibility = visibility,
    )
