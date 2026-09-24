import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from accounts.models import User
from tickets.models import Ticket

pytestmark = pytest.mark.django_db


def test_seed_demo_builds_the_world_with_passwords():
    call_command("seed_demo")
    assert Ticket.objects.count() == 3
    assert User.objects.get(email="alice@acme.test").check_password("demo-password-123")


def test_seed_demo_is_idempotent_and_reset_rebuilds():
    call_command("seed_demo")
    call_command("seed_demo")
    assert Ticket.objects.count() == 3
    call_command("seed_demo", "--reset")
    assert Ticket.objects.count() == 3


def test_seed_demo_refuses_production(settings):
    settings.ENV = "production"
    with pytest.raises(CommandError, match="production"):
        call_command("seed_demo")
