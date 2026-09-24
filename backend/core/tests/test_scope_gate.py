"""The scope mutation gate: under --scope-mutation, pytest exits 0 only if every scope test bites."""

CASE = """
import dataclasses, pytest

@dataclasses.dataclass(frozen=True)
class Case:
    visible: bool

@pytest.fixture(params=[Case(True), Case(False)], ids=["visible", "hidden"])
def scope_case(request):
    return request.param
"""


def run(pytester, body, *args):
    pytester.makepyfile(test_fake=CASE + body)
    return pytester.runpytest("-p", "no:django", "-p", "no:xdist", "-p", "tests.scope_gate", *args)


def test_passes_when_every_scope_test_fails_under_mutation(pytester):
    result = run(pytester, "@pytest.mark.scope\ndef test_a(scope_case):\n    assert False\n", "--scope-mutation")
    assert result.ret == 0
    result.stdout.fnmatch_lines(["*Scope mutation check OK*"])


def test_fails_when_a_scope_function_survives_the_mutation(pytester):
    body = (
        "@pytest.mark.scope\ndef test_bites(scope_case):\n    assert False\n"
        "@pytest.mark.scope\ndef test_toothless(scope_case):\n    assert True\n"
    )
    result = run(pytester, body, "--scope-mutation")
    assert result.ret == 1
    result.stdout.fnmatch_lines(["*survived*test_toothless*"])


def test_fails_when_a_not_visible_case_survives(pytester):
    body = "@pytest.mark.scope\ndef test_a(scope_case):\n    assert scope_case.visible is False\n"
    result = run(pytester, body, "--scope-mutation")
    assert result.ret == 1
    result.stdout.fnmatch_lines(["*survived*test_a?hidden?*"])


def test_fails_when_no_scope_tests_are_collected(pytester):
    result = run(pytester, "def test_unmarked():\n    assert False\n", "--scope-mutation", "-m", "scope")
    assert result.ret != 0


def test_setup_errors_do_not_count_as_biting(pytester):
    body = (
        "@pytest.fixture\ndef broken():\n    raise RuntimeError('db down')\n"
        "@pytest.mark.scope\ndef test_a(scope_case, broken):\n    assert False\n"
    )
    result = run(pytester, body, "--scope-mutation")
    assert result.ret != 0


def test_non_assertion_errors_do_not_count_as_biting(pytester):
    body = "@pytest.mark.scope\ndef test_a(scope_case):\n    raise ConnectionError('db down')\n"
    result = run(pytester, body, "--scope-mutation")
    assert result.ret != 0


def test_inactive_without_the_option(pytester):
    result = run(pytester, "@pytest.mark.scope\ndef test_a(scope_case):\n    assert True\n")
    assert result.ret == 0
