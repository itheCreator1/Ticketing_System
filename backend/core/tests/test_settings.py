import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from django.db import connection


@pytest.mark.django_db
def test_tests_run_on_postgresql():
    assert connection.vendor == "postgresql"


@pytest.mark.django_db
def test_test_database_is_scoped_to_the_worktree():
    expected = os.environ.get("SD_TEST_DB")
    if not expected:
        pytest.skip("run through `make test-backend` so SD_TEST_DB is set")
    # pytest-xdist appends _gwN per worker, so compare the prefix.
    assert connection.settings_dict["NAME"].startswith(expected)


def _load_settings(**env: str) -> subprocess.CompletedProcess[str]:
    """Import config.settings in a clean process with only the given DJANGO_* variables."""
    clean = {k: v for k, v in os.environ.items() if not k.startswith("DJANGO_")}
    code = (
        "import json, config.settings as s;"
        "print(json.dumps({'env': s.ENV, 'debug': s.DEBUG, 'hosts': s.ALLOWED_HOSTS,"
        " 'media': str(getattr(s, 'MEDIA_ROOT', ''))}))"
    )
    return subprocess.run(  # noqa: S603
        [sys.executable, "-c", code],
        env={**clean, **env},
        cwd=Path(__file__).resolve().parents[2],
        capture_output=True,
        text=True,
        check=False,
    )


def test_missing_environment_means_production_and_requires_a_secret_key():
    result = _load_settings()
    assert result.returncode != 0
    assert "DJANGO_SECRET_KEY is required in production" in result.stderr


def test_missing_environment_with_a_key_is_production_without_debug():
    result = _load_settings(DJANGO_SECRET_KEY="x" * 50)
    assert result.returncode == 0, result.stderr
    loaded = json.loads(result.stdout)
    assert (loaded["env"], loaded["debug"]) == ("production", False)


def test_internal_hostname_stays_allowed_when_hosts_are_narrowed():
    # The container healthcheck calls Django with Host: backend (spec: ALLOWED_HOSTS lists the internal hostname).
    result = _load_settings(DJANGO_ENV="development", DJANGO_ALLOWED_HOSTS="desk.example.com")
    assert result.returncode == 0, result.stderr
    assert set(json.loads(result.stdout)["hosts"]) == {"desk.example.com", "backend"}


def test_private_uploads_live_on_the_media_volume():
    result = _load_settings(DJANGO_ENV="development", DJANGO_MEDIA_ROOT="/srv/uploads")
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["media"] == "/srv/uploads"
