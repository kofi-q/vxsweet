load("@aspect_rules_js//js:defs.bzl", _js_binary = "js_binary")

def js_binary(
        name,
        src,
        entry_point,
        data = [],
        visibility = None):
    _js_binary(
        name = name,
        data = data + [
            src,
            "//:node_modules/tsx",
            "//:tsconfig_base",
        ],
        entry_point = entry_point,
        node_options = [
            # Run with `tsx` to enable tsconfig-path-based import resolution and
            # `esbuild`-based runtime transpilation, when needed.
            "--import",
            "tsx",
        ],
        visibility = visibility,
    )
