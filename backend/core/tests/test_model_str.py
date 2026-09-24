import pytest

from access.models import OrganizationGrant, PersonGrant
from organizations.models import TicketCounter

pytestmark = pytest.mark.django_db


def test_models_have_readable_names(world):
    acme1 = world.ticket("ACME-1")
    assert str(world.orgs["ACME"]) == "ACME"
    assert str(TicketCounter.objects.get(organization__key="ACME")) == "ACME: 2"
    assert str(acme1) == "ACME-1"
    first = acme1.events.first()
    assert str(first) == f"ACME-1 #{first.pk} (public)"
    assert str(OrganizationGrant.objects.get()) == "maria@servicedesk.test → ACME"
    assert str(PersonGrant.objects.get()) == "nikos@servicedesk.test → alice@acme.test"
