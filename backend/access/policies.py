"""The ONE scope function. Every ticket query starts here (docs/implementation-plan.md → One scope function).

Call as `policies.accessible_tickets(...)` (module attribute) so `make scope-mutation-check` can patch it.
"""

from django.db.models import Q, QuerySet

from accounts.models import Role
from tickets.models import Event, Ticket

from .models import OrganizationGrant, PersonGrant


def accessible_tickets(user) -> QuerySet[Ticket]:
    tickets = Ticket.objects.all()
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return tickets.none()
    if user.role == Role.SUPERADMIN:
        return tickets
    if user.role == Role.ADMIN:
        return tickets.filter(
            Q(organization__in=OrganizationGrant.objects.filter(admin=user).values("organization"))
            | Q(requester__in=PersonGrant.objects.filter(admin=user).values("customer"))
        )
    if user.role == Role.CUSTOMER_MANAGER:
        return tickets.filter(organization_id=user.organization_id)
    if user.role == Role.CUSTOMER_USER:
        return tickets.filter(requester=user)
    return tickets.none()


def visible_events(user, ticket: Ticket) -> QuerySet[Event]:
    """Events of a ticket the caller can already see. Customers get public events only."""
    events = ticket.events.all()
    return events if user.is_staff_member else events.filter(visibility="public")
