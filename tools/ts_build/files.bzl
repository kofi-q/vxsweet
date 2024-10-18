# TODO: Paying some overlapping cost of these globs across the various ts_build
# macros - could consolidate into a one-time call in the BUILD file for a struct
# that gets passed to the various macros.

def list_all_files():
    return native.glob(
        ["**/*.ts", "**/*.tsx"],
        allow_empty = True,
    )

def list_source_files():
    TEST_FILES = list_test_files()
    STORY_FILES = list_story_files()

    return native.glob(
        ["**/*.ts", "**/*.tsx"],
        allow_empty = True,
        exclude = TEST_FILES + STORY_FILES,
    )

def list_test_files():
    return native.glob(
        ["**/*.test.ts", "**/*.test.tsx"],
        allow_empty = True,
    )

def list_story_files():
    return native.glob(
        ["**/*.stories.ts", "**/*.stories.tsx"],
        allow_empty = True,
    )
