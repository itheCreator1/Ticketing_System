import pytest

from access.models import OrganizationGrant, PersonGrant
from tests.scope import ACTORS, TICKETS, VISIBLE
from tests.world import INTERNAL_SENTINEL, PUBLIC_SENTINEL

pytestmark = pytest.mark.django_db


def test_world_has_the_named_actors_and_tickets(world):
    assert {world.user(a).email.split("@")[0] for a in ACTORS} == set(ACTORS)
    assert {world.ticket(k).key for k in TICKETS} == set(TICKETS)


def test_world_grants_match_the_maria_nikos_example(world):
    assert OrganizationGrant.objects.filter(admin=world.user("maria"), organization__key="ACME").exists()
    assert PersonGrant.objects.filter(admin=world.user("nikos"), customer=world.user("alice")).exists()
    assert not world.user("otto").organization_grants.exists()


def test_acme_1_carries_public_and_internal_sentinels(world):
    bodies = {e.visibility: e.body for e in world.ticket("ACME-1").events.all()}
    assert PUBLIC_SENTINEL in bodies["public"] and INTERNAL_SENTINEL in bodies["internal"]


def test_visibility_table_covers_every_actor():
    assert set(VISIBLE) == set(ACTORS)
