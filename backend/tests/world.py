"""The shared fixture world. Grows per phase (docs/implementation-plan.md → Testing foundations)."""

from dataclasses import dataclass

from access.models import OrganizationGrant, PersonGrant
from accounts.models import Role, User
from organizations.models import Organization
from tickets.models import Ticket, Visibility
from tickets.services import add_event, create_ticket

PUBLIC_SENTINEL = "zebra-public-7Q"
INTERNAL_SENTINEL = "okapi-internal-9X"

# name -> (role, organization key or None)
PEOPLE: dict[str, tuple[Role, str | None]] = {
    "sam": (Role.SUPERADMIN, None),
    "maria": (Role.ADMIN, None),
    "nikos": (Role.ADMIN, None),
    "otto": (Role.ADMIN, None),
    "alice": (Role.CUSTOMER_USER, "ACME"),
    "bob": (Role.CUSTOMER_USER, "ACME"),
    "carol": (Role.CUSTOMER_MANAGER, "ACME"),
    "gina": (Role.CUSTOMER_USER, "GLOBX"),
}
DOMAINS = {None: "servicedesk.test", "ACME": "acme.test", "GLOBX": "globx.test"}


@dataclass
class World:
    orgs: dict[str, Organization]
    users: dict[str, User]
    tickets: dict[str, Ticket]

    def user(self, name: str) -> User:
        return self.users[name]

    def ticket(self, key: str) -> Ticket:
        return self.tickets[key]


def build_world(password: str | None = None) -> World:
    orgs = {
        "ACME": Organization.objects.create(name="Acme", key="ACME"),
        "GLOBX": Organization.objects.create(name="Globex", key="GLOBX"),
    }
    users = {
        name: User.objects.create_user(
            f"{name}@{DOMAINS[org]}",
            password,
            display_name=name.capitalize(),
            role=role,
            organization=orgs[org] if org else None,
        )
        for name, (role, org) in PEOPLE.items()
    }
    OrganizationGrant.objects.create(admin=users["maria"], organization=orgs["ACME"])
    PersonGrant.objects.create(admin=users["nikos"], customer=users["alice"])

    acme1 = create_ticket(users["alice"], "Printer offline", f"The printer is offline. {PUBLIC_SENTINEL}")
    add_event(acme1, users["maria"], f"Checking the printer queue. {PUBLIC_SENTINEL}", Visibility.PUBLIC)
    add_event(acme1, users["maria"], f"Vendor contract expired. {INTERNAL_SENTINEL}", Visibility.INTERNAL)
    acme2 = create_ticket(users["bob"], "VPN access", "Need VPN access.")
    globx1 = create_ticket(users["gina"], "Invoice copy", "Please resend the invoice.")
    return World(orgs=orgs, users=users, tickets={t.key: t for t in (acme1, acme2, globx1)})
