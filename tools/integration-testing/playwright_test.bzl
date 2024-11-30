load("@npm//:playwright/package_json.bzl", playwright = "bin")

def playwright_test(
        name,
        srcs,
        test_dir,
        prod_app,
        port,
        viewport_height,
        viewport_width,
        vx_machine_type,
        data = [],
        additional_env_vars = {},
        tags = [],
        size = "enormous",
        timeout = "moderate"):
    playwright.playwright_test(
        name = name,
        size = size,
        timeout = timeout,
        args = [
            "test",
            "-c",
            "$(rootpath //tools/playwright:config.js)",
        ],
        data = srcs + data + [
            "//:env",
            "//:node_modules/@playwright/browser-chromium",
            "//:node_modules/tsx",
            "//:tsconfig",
            "//tools/playwright:config.js",
            prod_app,
        ] + native.glob(["**/.env"], allow_empty = True),
        env = {
            "DOTENV_EXECUTION_ROOT": native.package_name(),
            "IS_INTEGRATION_TEST": "true",
            "NODE_ENV": "production",
            "INTEGRATION_PACKAGE_PATH": native.package_name(),
            "PORT": port,
            "INTEGRATION_SERVER_START_SCRIPT": "cd $${TEST_SRCDIR}/$${TEST_WORKSPACE} && $(rootpath %s)" % prod_app,
            "INTEGRATION_TEST_DIR": test_dir,
            "PLAYWRIGHT_BROWSERS_PATH": "./node_modules/@playwright/browser-chromium",
            "VIEWPORT_HEIGHT": viewport_height,
            "VIEWPORT_WIDTH": viewport_width,
            "VX_MACHINE_TYPE": vx_machine_type,
        } | additional_env_vars,
        tags = tags + ["integration", "js", "playwright", "ts"],
        node_options = [
            "--import",
            "tsx",
            "--import",
            "@playwright/browser-chromium",
        ],
    )
