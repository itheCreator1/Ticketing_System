"""pytest plugin: the scope mutation gate.

Under --scope-mutation the conftest replaces the scope functions with unscoped versions. The run then
exits 0 only if every `scope`-marked test function has a case that fails on an assertion, and every
scope_case that expects 404 (not visible) fails. Anything else exits 1, and so does an interrupted,
erroring, or empty run, so a broken harness can never look like a passing gate.
"""

import pytest


def pytest_addoption(parser):
    parser.addoption(
        "--scope-mutation",
        action="store_true",
        help="Replace the scope functions with unscoped versions; scope tests must then FAIL.",
    )


@pytest.hookimpl(wrapper=True)
def pytest_runtest_makereport(item, call):
    report = yield
    if item.config.getoption("--scope-mutation") and item.get_closest_marker("scope"):
        case = getattr(getattr(item, "callspec", None), "params", {}).get("scope_case")
        bit = call.when == "call" and call.excinfo is not None and call.excinfo.errisinstance(AssertionError)
        report.user_properties.append(("scope_gate", (call.when, bit, case is not None and not case.visible)))
    return report


class _Gate:
    def __init__(self):
        self.functions: dict[str, bool] = {}
        self.hidden_survivors: list[str] = []
        self.errors: list[str] = []

    def pytest_runtest_logreport(self, report):
        for _name, (when, bit, hidden) in (p for p in report.user_properties if p[0] == "scope_gate"):
            if when != "call":
                if report.failed:
                    self.errors.append(report.nodeid)
                continue
            if report.skipped:
                continue
            function = report.nodeid.split("[", 1)[0]
            self.functions[function] = self.functions.get(function, False) or bit
            if hidden and not bit:
                self.hidden_survivors.append(report.nodeid)

    @pytest.hookimpl(trylast=True)
    def pytest_sessionfinish(self, session):
        if session.exitstatus not in (pytest.ExitCode.OK, pytest.ExitCode.TESTS_FAILED):
            return  # interrupted, internal/usage error, or nothing collected: keep the non-zero code
        problems = [f"survived: {f}" for f, bit in sorted(self.functions.items()) if not bit]
        problems += [f"survived: {n}" for n in self.hidden_survivors]
        problems += [f"errored (does not count as biting): {n}" for n in self.errors]
        if not self.functions:
            problems.append("no scope tests ran")
        write = session.config.get_terminal_writer().line
        write("")
        for problem in problems:
            write(f"SCOPE MUTATION CHECK FAILED — {problem}")
        if problems:
            session.exitstatus = pytest.ExitCode.TESTS_FAILED
        else:
            write(f"Scope mutation check OK: all {len(self.functions)} scope test functions fail without scoping")
            session.exitstatus = pytest.ExitCode.OK


def pytest_configure(config):
    # Decide once, on the controller: xdist workers only forward their reports.
    if config.getoption("--scope-mutation") and not hasattr(config, "workerinput"):
        config.pluginmanager.register(_Gate(), "scope-gate")
