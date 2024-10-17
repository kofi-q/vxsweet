def list_source_files():
    TEST_FILES = list_test_files()
    STORY_FILES = list_story_files()

    return native.glob(
        ["**/*.ts?(x)"],
        allow_empty = True,
        exclude = TEST_FILES + STORY_FILES,
    )

def list_test_files():
    return native.glob(
        ["**/*.test.ts?(x)"],
        allow_empty = True,
    )

def list_story_files():
    return native.glob(
        ["**/*.stories.ts?(x)"],
        allow_empty = True,
    )
