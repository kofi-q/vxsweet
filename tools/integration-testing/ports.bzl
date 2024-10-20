# Defines different ports for each backend, to enable running integration tests
# for different apps in parallel in CI.
INTEGRATION_TEST_PORTS = struct(
    admin = "3010",
    central_scan = "3020",
    mark = "3030",
    mark_scan = "3040",
    scan = "3050",
)
