import pytest
from django.core.exceptions import ValidationError
from django.db import DatabaseError, IntegrityError

from organizations.models import Organization, TicketCounter

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("bad_key", ["A", "acme", "ACME1", "TOOLONGKEYXX", "AC-ME", ""])
def test_key_validator_rejects_bad_keys(bad_key):
    with pytest.raises(ValidationError):
        Organization(name="X", key=bad_key).full_clean()


def test_database_rejects_bad_key_even_without_validation():
    with pytest.raises(IntegrityError):
        Organization.objects.create(name="X", key="acme")


def test_key_cannot_change_through_save():
    org = Organization.objects.create(name="Acme", key="ACME")
    org.key = "ACMX"
    with pytest.raises(ValueError, match="immutable"):
        org.save()


def test_key_cannot_change_through_queryset_update():
    org = Organization.objects.create(name="Acme", key="ACME")
    with pytest.raises(DatabaseError, match="immutable"):
        Organization.objects.filter(pk=org.pk).update(key="ACMX")


def test_creating_an_organization_creates_its_ticket_counter():
    org = Organization.objects.create(name="Acme", key="ACME")
    assert TicketCounter.objects.get(organization=org).last_number == 0
