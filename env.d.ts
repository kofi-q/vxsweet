declare namespace NodeJS {
  export interface ProcessEnv {
    ADMIN_ALLOWED_EXPORT_PATTERNS?: string;
    ADMIN_WORKSPACE?: string;
    CI?: string;
    DISABLE_MARKSCAN_HOT_RELOAD?: 'true' | 'false';
    /**
     * The repo-relative path to a directory containing .env files.
     * Used by the dotenv resolution script to figure out which .env files to
     * load in addition to the root .env file.
     *
     * See libs/backend/src/dotenv.ts
     */
    DOTENV_EXECUTION_ROOT?: string;
    IS_INTEGRATION_TEST?: string;
    KIOSK_BROWSER_ALLOW_DEVTOOLS?: string;
    KIOSK_BROWSER_FILE_PERMISSIONS?: string;
    KIOSK_BROWSER_HELP?: string;
    KIOSK_BROWSER_URL?: string;
    MARK_SCAN_WORKSPACE?: string;
    MARK_WORKSPACE?: string;
    NODE_ENV: 'development' | 'production' | 'test';
    PIPENV_VENV_IN_PROJECT?: string;
    PORT?: string;
    REACT_APP_VX_APP_MODE?: string;
    REACT_APP_VX_CODE_VERSION?: string;
    REACT_APP_VX_CONVERTER?: string;
    REACT_APP_VX_DEV?: string;
    REACT_APP_VX_DISABLE_BALLOT_BOX_CHECK?: string;
    REACT_APP_VX_ENABLE_ALL_ZERO_SMARTCARD_PIN_GENERATION?: string;
    REACT_APP_VX_ENABLE_CLOUD_TRANSLATION_AND_SPEECH_SYNTHESIS?: string;
    REACT_APP_VX_ENABLE_DEV_DOCK?: string;
    REACT_APP_VX_ENABLE_REACT_QUERY_DEVTOOLS?: string;
    REACT_APP_VX_ENABLE_WRITE_IN_ADJUDICATION?: string;
    REACT_APP_VX_MACHINE_ID?: string;
    REACT_APP_VX_MARK_SCAN_DISABLE_BALLOT_REINSERTION?: string;
    REACT_APP_VX_MARK_SCAN_USE_BMD_150?: string;
    REACT_APP_VX_ONLY_ENABLE_SCREEN_READER_FOR_HEADPHONES?: string;
    REACT_APP_VX_SKIP_CAST_VOTE_RECORDS_AUTHENTICATION?: string;
    REACT_APP_VX_SKIP_CVR_BALLOT_HASH_CHECK?: string;
    REACT_APP_VX_SKIP_ELECTION_PACKAGE_AUTHENTICATION?: string;
    REACT_APP_VX_SKIP_PIN_ENTRY?: string;
    REACT_APP_VX_SKIP_SYSTEM_AUDIO_SETUP?: string;
    REACT_APP_VX_USE_BROTHER_PRINTER?: string;
    REACT_APP_VX_USE_CUSTOM_SCANNER?: string;
    REACT_APP_VX_USE_MOCK_CARDS?: string;
    REACT_APP_VX_USE_MOCK_PAPER_HANDLER?: string;
    REACT_APP_VX_USE_MOCK_PRINTER?: string;
    REACT_APP_VX_USE_MOCK_USB_DRIVE?: string;
    SCAN_ALLOWED_EXPORT_PATTERNS?: string;
    SCAN_WORKSPACE?: string;
    /**
     * App directory containing static frontend files to serve to the client.
     * Used by app backend prod servers.
     */
    STATIC_FILE_DIR?: string;
    VX_CODE_VERSION?: string;
    VX_CONFIG_ROOT?: string;
    VX_MACHINE_ID?: string;
    VX_MACHINE_JURISDICTION?: string;
    VX_MACHINE_TYPE?: 'admin' | 'central-scan' | 'mark' | 'mark-scan' | 'scan';
    VX_SCREEN_ORIENTATION?: 'portrait' | 'landscape';
    WORKSPACE?: string;

    //
    // Bazel build env variables:
    //

    /**
     * Absolute path to the directory from which bazel was invoked, for scripts
     * that need to perform actions relative to the current working directory.
     *
     * NOTE: This is different from `process.cwd()`, which will always point to
     * a directory within the bazel output tree or sandbox for any code running
     * under bazel.
     */
    BUILD_WORKING_DIRECTORY?: string;

    /**
     * Absolute path to the root of the original source tree, for scripts that
     * need to modify or generate code/data files in the original workspace.
     */
    BUILD_WORKSPACE_DIRECTORY?: string;

    /**
     * `true` if tests are being executed via Bazel. Enables configuration based
     * run type (i.e. under Bazel, or directly with, say, `pnpm jest`).
     */
    IS_BAZEL_TEST?: 'true' | 'false';

    /**
     * Specifies the jest runtime environment. Defaults to `jsdom` for test
     * suites containing `.tsx` files or references to `React`,
     * otherwise, `node`.
     */
    JEST_ENVIRONMENT?: 'jsdom' | 'node';

    /**
     * When running under Bazel, `PWD` is set to the absolute path to the root
     * of the Bazel sandbox, which mirrors the root of the repo.
     */
    PWD?: string;

    /**
     * Hermetic/sandboxed tmp dir path for bazel tests.
     */
    TEST_TMPDIR?: string;

    /**
     * Similar to {@link TEST_TMPDIR}, but more generally available outside of
     * Bazel - when running under Bazel, this will be set to a Bazel-specific
     * sandbox path and will be equal to {@link TEST_TMPDIR} when running tests.
     */
    TMPDIR?: string;
  }
}
