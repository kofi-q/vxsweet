"""
Common build definitions for JavaScript/TypeScript packages.
"""

load("@aspect_rules_js//js:defs.bzl", "js_library")
load("@aspect_rules_ts//ts:defs.bzl", "ts_project")

def ts_library(
        name,
        srcs,
        deps,
        data = [],
        tags = [],
        visibility = None):
    """Declares build targets for a Typescript source library package.

    Args:
      name: Name for the generated build target.
      srcs: Typescript source files.
      data: Data files needed at runtime.
      deps: Imported dependencies for this package, including node_modules dependencies.
      tags: Tags to attach to the generated targets.
      visibility: Defaults to package private.
    """

    ts_project(
        name = name,
        srcs = srcs,
        allow_js = True,
        data = data,
        declaration = True,
        declaration_map = True,
        incremental = True,
        preserve_jsx = False,
        resolve_json_module = True,
        transpiler = "tsc",
        tags = tags + ["js", "ts"],
        tsconfig = "//:tsconfig",
        visibility = visibility,
        deps = deps,
    )

def ts_package(
        name = "lib",
        src_deps = [],
        src_data = [],
        test_deps = [],
        test_data = [],
        type_deps = [],
        test_env = {},
        test_type = None,
        story_deps = [],
        test_size = "small",
        test_skip_all = False,
        test_timeout = None,
        test_workers_max = 1,
        unsound_disable_node_fs_patch_for_tests = False,
        visibility = ["//visibility:public"]):
    """Declares build targets for a Typescript source library package.

       Generates the following build targets, depending on the contents of the
       directory and/or subdirectories:
         - :<name> - the main build target for all source files.
         - :tests - executable test target for all `*.test.ts[x]` files.
         - :types - build target for `*.d.ts` files that can be used as a
                    dependency for downstream targaets.
         - :stories - build target for all `*.stories.ts[x]` files.

    Args:
      name: Name for the main source target. This should usually match the name
          of the package/directory.

      src_deps: Source file dependencies, including node_modules dependencies.

      src_data: Data/script/asset files loaded by tests or needed at runtime.

      story_deps: Story file dependencies, including node_modules dependencies.

      test_deps: Test file dependencies, including node_modules dependencies.

      test_data: Data/script/asset files loaded by tests or needed for test
          execution.

      type_deps: Test file dependencies, including node_modules dependencies.

      test_env: Additional environment variables to set for the test target.

      test_type: Jest test env ("jsdom" | "node"). Defaults to "jsdom" if .tsx
          files are included, else "node".

      test_size: Size tag for the test target - defaults to "small".

      test_skip_all: Skip all tests in this package. For local development only.

      test_timeout: Timeout ("short" | "moderate" | "long" | "eternal") for the
          test target. Default value will correspond to the `test_size`.

      test_workers_max: Defaults to 1. Consider splitting packages into smaller
          chunks before resorting to sharding tests.

      unsound_disable_node_fs_patch_for_tests: Disables node:fs patching that's
          put in place to prevent tests from accessing files outside of the
          sandbox and breaking hermeticity. Useful for any tests that rely on
          specific behaviour that may be modified by the patches.

      visibility: Visibility of the main lib target. Defaults to public.
    """

    TS_TEST_FILES = native.glob(
        ["**/*.test.ts"],
        allow_empty = True,
    )
    REACT_TEST_FILES = native.glob(
        ["**/*.test.tsx"],
        allow_empty = True,
    )
    TEST_FILES = TS_TEST_FILES + REACT_TEST_FILES

    STORY_FILES = native.glob(
        [
            "**/*.stories.ts",
            "**/*.stories.tsx",
        ],
        allow_empty = True,
    )

    TS_SOURCE_FILES = native.glob(
        ["**/*.ts"],
        allow_empty = True,
        exclude = TEST_FILES + STORY_FILES,
    )
    REACT_SOURCE_FILES = native.glob(
        ["**/*.tsx"],
        allow_empty = True,
        exclude = TEST_FILES + STORY_FILES,
    )
    SOURCE_FILES = TS_SOURCE_FILES + REACT_SOURCE_FILES

    def _newTarget(base_name = None):
        target_name = base_name
        target_label = ":{}".format(base_name)

        return struct(
            name = target_name,
            label = target_label,
        )

    target_main = _newTarget(name)
    target_lint = _newTarget("lint")
    target_stories = _newTarget("stories")
    target_tests = _newTarget("tests")
    target_tests_lib = _newTarget("tests_lib")

    if SOURCE_FILES:
        ts_library(
            name = target_main.name,
            srcs = SOURCE_FILES,
            visibility = visibility,
            deps = src_deps,
            data = src_data,
            tags = ["src"],
        )

    if TEST_FILES and not test_skip_all:
        # TODO: Add jest test target
        ts_library(
            name = target_tests_lib.name,
            srcs = TEST_FILES,
            deps = test_deps,
            tags = ["test_files"],
        )

    if STORY_FILES:
        ts_library(
            name = target_stories.name,
            srcs = STORY_FILES,
            deps = story_deps,
            tags = ["stories"],
        )

    # TODO: Add eslint target

def json_package(
        name,
        tags = [],
        visibility = ["//visibility:public"]):
    """Declares a build target for a JSON package importable by  `ts_package` targets.

    Args:
      name: Name for the generated build target.
      tags: Optional additional tags to attach to the generated.
      visibility: Defaults to public.
    """

    JSON_FILES = native.glob(
        ["**/*.json"],
        allow_empty = True,
    )

    js_library(
        name = name,
        srcs = JSON_FILES,
        tags = tags + ["json"],
        visibility = visibility,
    )
