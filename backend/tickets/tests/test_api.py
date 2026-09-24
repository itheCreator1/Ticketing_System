import pytest

from tests.scope import STAFF, VISIBLE, assert_no_internal
from tests.world import INTERNAL_SENTINEL

pytestmark = pytest.mark.django_db


@pytest.mark.scope
def test_ticket_detail_follows_scope(world, api, scope_case):
    response = api(world.user(scope_case.actor)).get(f"/api/v1/tickets/{scope_case.ticket}/")
    assert response.status_code == (200 if scope_case.visible else 404)


@pytest.mark.scope
def test_ticket_list_follows_scope(world, api, scope_actor):
    response = api(world.user(scope_actor)).get("/api/v1/tickets/")
    assert response.status_code == 200
    assert {t["key"] for t in response.json()["results"]} == VISIBLE[scope_actor]


@pytest.mark.scope
def test_internal_content_reaches_staff_only(world, api, scope_actor):
    if "ACME-1" not in VISIBLE[scope_actor]:
        pytest.skip("actor cannot see ACME-1")
    response = api(world.user(scope_actor)).get("/api/v1/tickets/ACME-1/")
    if scope_actor in STAFF:
        assert INTERNAL_SENTINEL in response.content.decode()  # positive control
    else:
        assert_no_internal(response)


def test_anonymous_requests_get_401(api):
    assert api().get("/api/v1/tickets/").status_code == 401


def test_deactivated_user_with_a_live_session_gets_401(world, api):
    client = api(world.user("alice"))
    alice = world.user("alice")
    alice.is_active = False
    alice.save()
    assert client.get("/api/v1/tickets/").status_code == 401


@pytest.mark.parametrize("key", ["acme-1", "Acme-1"])
def test_ticket_keys_are_case_insensitive(world, api, key):
    response = api(world.user("alice")).get(f"/api/v1/tickets/{key}/")
    assert response.status_code == 200 and response.json()["key"] == "ACME-1"


@pytest.mark.parametrize("key", ["ACME", "ACME-x", "A-1", "ACME-1-2", "ACME--1"])
def test_malformed_keys_are_404(world, api, key):
    assert api(world.user("sam")).get(f"/api/v1/tickets/{key}/").status_code == 404


def test_list_query_count_does_not_grow_per_row(world, api, django_assert_max_num_queries):
    client = api(world.user("sam"))
    with django_assert_max_num_queries(5):
        client.get("/api/v1/tickets/")


def test_detail_shape(world, api):
    body = api(world.user("maria")).get("/api/v1/tickets/ACME-1/").json()
    assert set(body) == {"key", "subject", "status", "organization", "created_at", "events"}
    assert set(body["events"][0]) == {"id", "visibility", "body", "created_at"}
