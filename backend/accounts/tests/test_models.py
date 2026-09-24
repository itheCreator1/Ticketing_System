import pytest
from django.db import IntegrityError

from accounts.models import Role, User
from organizations.models import Organization

pytestmark = pytest.mark.django_db


@pytest.fixture
def acme():
    return Organization.objects.create(name="Acme", key="ACME")


def test_create_user_lowercases_email(acme):
    user = User.objects.create_user("Alice@ACME.test", display_name="Alice", role=Role.CUSTOMER_USER, organization=acme)
    assert user.email == "alice@acme.test"
    assert not user.has_usable_password()


def test_customer_requires_an_organization():
    with pytest.raises(IntegrityError):
        User.objects.create_user("bob@acme.test", display_name="Bob", role=Role.CUSTOMER_USER)


def test_staff_cannot_belong_to_an_organization(acme):
    with pytest.raises(IntegrityError):
        User.objects.create_user("maria@sd.test", display_name="Maria", role=Role.ADMIN, organization=acme)


def test_user_without_a_valid_role_is_rejected():
    with pytest.raises(IntegrityError):
        User.objects.create_user("x@sd.test", display_name="X", role="")


def test_is_staff_member(acme):
    staff = User.objects.create_user("sam@sd.test", display_name="Sam", role=Role.SUPERADMIN)
    customer = User.objects.create_user("carol@acme.test", display_name="Carol", role=Role.CUSTOMER_MANAGER, organization=acme)
    assert staff.is_staff_member and not customer.is_staff_member
