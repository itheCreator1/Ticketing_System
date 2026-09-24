import pytest
from django.db import IntegrityError

from access.models import OrganizationGrant, PersonGrant
from accounts.models import Role, User
from organizations.models import Organization

pytestmark = pytest.mark.django_db


@pytest.fixture
def people():
    acme = Organization.objects.create(name="Acme", key="ACME")
    return {
        "acme": acme,
        "maria": User.objects.create_user("maria@sd.test", display_name="Maria", role=Role.ADMIN),
        "sam": User.objects.create_user("sam@sd.test", display_name="Sam", role=Role.SUPERADMIN),
        "alice": User.objects.create_user("alice@acme.test", display_name="Alice", role=Role.CUSTOMER_USER, organization=acme),
    }


def test_only_admins_receive_grants(people):
    with pytest.raises(ValueError, match="admin"):
        OrganizationGrant.objects.create(admin=people["sam"], organization=people["acme"])
    with pytest.raises(ValueError, match="admin"):
        PersonGrant.objects.create(admin=people["alice"], customer=people["alice"])


def test_person_grant_target_must_be_a_customer(people):
    with pytest.raises(ValueError, match="customer"):
        PersonGrant.objects.create(admin=people["maria"], customer=people["sam"])


def test_grants_are_unique(people):
    OrganizationGrant.objects.create(admin=people["maria"], organization=people["acme"])
    with pytest.raises(IntegrityError):
        OrganizationGrant.objects.create(admin=people["maria"], organization=people["acme"])
