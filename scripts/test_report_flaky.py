import json
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).with_name("report_flaky.py")


def run(tmp_path, report):
    path = tmp_path / "results.json"
    path.write_text(json.dumps(report))
    return subprocess.run([sys.executable, SCRIPT, path], capture_output=True, text=True)


def spec(title, status):
    return {"title": title, "tests": [{"status": status, "projectName": "gating"}]}


def test_lists_flaky_tests(tmp_path):
    out = run(tmp_path, {"suites": [{"title": "a.spec.ts", "specs": [spec("home", "flaky"), spec("ok", "expected")]}]})
    assert out.returncode == 0
    assert "FLAKY a.spec.ts › home" in out.stdout and "ok" not in out.stdout.replace("FLAKY", "")


def test_reports_none_when_clean(tmp_path):
    out = run(tmp_path, {"suites": [{"title": "a.spec.ts", "specs": [spec("ok", "expected")], "suites": []}]})
    assert "No flaky tests." in out.stdout


def test_missing_results_are_reported_not_a_crash(tmp_path):
    out = subprocess.run([sys.executable, SCRIPT, tmp_path / "absent.json"], capture_output=True, text=True)
    assert out.returncode == 0, out.stderr
    assert "No E2E results" in out.stdout
