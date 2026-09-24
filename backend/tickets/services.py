from django.db import transaction

from accounts.models import CUSTOMER_ROLES
from organizations.models import TicketCounter

from .errors import TicketRuleError
from .models import Event, Ticket, Visibility


def create_ticket(requester, subject: str, body: str) -> Ticket:
    """Create a ticket for its requester (always the creator) with a per-organization number."""
    if requester.role not in CUSTOMER_ROLES:
        raise TicketRuleError("Only customers create tickets, always for themselves")
    with transaction.atomic():
        counter = TicketCounter.objects.select_for_update().get(organization_id=requester.organization_id)
        counter.last_number += 1
        counter.save(update_fields=["last_number"])
        ticket = Ticket.objects.create(
            organization_id=requester.organization_id, number=counter.last_number, subject=subject, requester=requester
        )
        add_event(ticket, requester, body, Visibility.PUBLIC)
    return ticket


def add_event(ticket: Ticket, author, body: str, visibility: Visibility) -> Event:
    return Event.objects.create(ticket=ticket, author=author, body=body, visibility=visibility)
