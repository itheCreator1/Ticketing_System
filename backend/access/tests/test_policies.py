import pytest

from access import policies
from tests.scope import STAFF, VISIBLE
from tests.world import INTERNAL_SENTINEL

pytestmark = [pytest.mark.django_db, pytest.mark.scope]


def test_accessible_tickets_matches_the_visibility_table(world, scope_actor):
    tickets = policies.accessible_tickets(world.user(scope_actor)).select_related("organization")
    assert {t.key for t in tickets} == VISIBLE[scope_actor]


def test_internal_events_are_visible_to_staff_only(world, scope_actor):
    bodies = " ".join(e.body for e in policies.visible_events(world.user(scope_actor), world.ticket("ACME-1")))
    if scope_actor in STAFF:
        assert INTERNAL_SENTINEL in bodies  # positive control
    else:
        assert INTERNAL_SENTINEL not in bodies


def test_inactive_users_see_nothing(world):
    maria = world.user("maria")
    maria.is_active = False
    maria.save()
    assert not policies.accessible_tickets(maria).exists()


def test_anonymous_users_see_nothing(world):
    from django.contrib.auth.models import AnonymousUser

    assert not policies.accessible_tickets(AnonymousUser()).exists()
