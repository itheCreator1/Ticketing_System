import pytest
from rest_framework.test import APIClient

from tests.scope import ACTORS, SCOPE_CASES
from tests.world import build_world


def pytest_addoption(parser):
    parser.addoption(
        "--scope-mutation",
        action="store_true",
        help="Replace the scope functions with unscoped versions; scope tests must then FAIL.",
    )


def pytest_collection_modifyitems(config, items):
    for item in items:
        marker = item.get_closest_marker("quarantine")
        if marker and not (marker.args or marker.kwargs.get("issue")):
            raise pytest.UsageError(f"{item.nodeid}: @pytest.mark.quarantine needs an issue URL")


@pytest.fixture(autouse=True)
def _scope_mutation(request, monkeypatch):
    if request.config.getoption("--scope-mutation"):
        from access import policies
        from tickets.models import Ticket

        monkeypatch.setattr(policies, "accessible_tickets", lambda user: Ticket.objects.all())
        monkeypatch.setattr(policies, "visible_events", lambda user, ticket: ticket.events.all())


@pytest.fixture
def world(db):
    return build_world()


@pytest.fixture(params=SCOPE_CASES, ids=lambda c: f"{c.actor}->{c.ticket}")
def scope_case(request):
    return request.param


@pytest.fixture(params=ACTORS)
def scope_actor(request):
    return request.param


@pytest.fixture
def api():
    def make(user=None, csrf: bool = True) -> APIClient:
        client = APIClient(enforce_csrf_checks=csrf)
        if user is not None:
            client.force_login(user)
        return client

    return make
