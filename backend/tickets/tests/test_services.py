import threading

import pytest
from django.db import connection

from accounts.models import Role, User
from organizations.models import Organization
from tickets.errors import TicketRuleError
from tickets.models import Status, Ticket, Visibility
from tickets.services import add_event, create_ticket


@pytest.fixture
def acme_alice(db):
    acme = Organization.objects.create(name="Acme", key="ACME")
    alice = User.objects.create_user("alice@acme.test", display_name="Alice", role=Role.CUSTOMER_USER, organization=acme)
    return acme, alice


def test_tickets_are_numbered_per_organization(acme_alice):
    acme, alice = acme_alice
    globx = Organization.objects.create(name="Globex", key="GLOBX")
    gina = User.objects.create_user("gina@globx.test", display_name="Gina", role=Role.CUSTOMER_USER, organization=globx)
    t1 = create_ticket(alice, "First", "body")
    t2 = create_ticket(alice, "Second", "body")
    g1 = create_ticket(gina, "Other org", "body")
    assert (t1.key, t2.key, g1.key) == ("ACME-1", "ACME-2", "GLOBX-1")


def test_new_ticket_is_open_with_a_public_first_event(acme_alice):
    _, alice = acme_alice
    ticket = create_ticket(alice, "Printer", "It is offline")
    assert ticket.status == Status.OPEN
    assert ticket.organization_id == alice.organization_id
    first = ticket.events.get()
    assert (first.visibility, first.author, first.body) == (Visibility.PUBLIC, alice, "It is offline")


def test_staff_cannot_create_tickets(db):
    sam = User.objects.create_user("sam@sd.test", display_name="Sam", role=Role.SUPERADMIN)
    with pytest.raises(TicketRuleError, match="customers"):
        create_ticket(sam, "x", "y")


def test_add_event_records_visibility(acme_alice):
    _, alice = acme_alice
    maria = User.objects.create_user("maria@sd.test", display_name="Maria", role=Role.ADMIN)
    ticket = create_ticket(alice, "Printer", "body")
    note = add_event(ticket, maria, "internal detail", Visibility.INTERNAL)
    assert list(ticket.events.order_by("id").values_list("visibility", flat=True)) == ["public", "internal"]
    assert note.author == maria


@pytest.mark.django_db(transaction=True)
def test_parallel_creation_gets_unique_sequential_numbers():
    acme = Organization.objects.create(name="Acme", key="ACME")
    alice = User.objects.create_user("alice@acme.test", display_name="Alice", role=Role.CUSTOMER_USER, organization=acme)
    start = threading.Barrier(8)

    def worker() -> None:
        try:
            start.wait()
            create_ticket(alice, "parallel", "body")
        finally:
            connection.close()

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(Ticket.objects.values_list("number", flat=True)) == list(range(1, 9))
