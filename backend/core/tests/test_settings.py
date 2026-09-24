import os

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
