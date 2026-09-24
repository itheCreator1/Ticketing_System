"""Print Playwright tests that only passed on retry ("flaky"). Appends to $GITHUB_STEP_SUMMARY in CI."""

import json
import os
import sys


def walk(suite, trail):
    title = [*trail, suite["title"]] if suite.get("title") else trail
    for spec in suite.get("specs", []):
        for test in spec.get("tests", []):
            if test.get("status") == "flaky":
                yield " › ".join([*title, spec["title"]])
    for child in suite.get("suites", []):
        yield from walk(child, title)


def main(path: str) -> None:
    with open(path) as fh:
        report = json.load(fh)
    flaky = [name for suite in report.get("suites", []) for name in walk(suite, [])]
    lines = [f"FLAKY {name}" for name in flaky] or ["No flaky tests."]
    print("\n".join(lines))
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as fh:
            fh.write("### Flaky E2E tests\n" + "\n".join(f"- {line}" for line in lines) + "\n")


if __name__ == "__main__":
    main(sys.argv[1])
