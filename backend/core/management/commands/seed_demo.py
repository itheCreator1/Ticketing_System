from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from accounts.models import User
from organizations.models import Organization
from tests.world import build_world
from tickets.models import Ticket

DEMO_PASSWORD = "demo-password-123"  # noqa: S105  # nosec B105 (documented demo-only credential)


class Command(BaseCommand):
    help = "Load the shared fixture world as demo data (never in production)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete all tickets, users, and organizations first.")

    def handle(self, *args, reset: bool = False, **options):
        if settings.ENV == "production":
            raise CommandError("seed_demo refuses to run in production")
        if reset:
            # ORM deletes, not `flush`: TRUNCATE fails inside transactions with pending FK checks,
            # and --reset should only remove domain data. Order respects PROTECT foreign keys.
            Ticket.objects.all().delete()
            User.objects.all().delete()
            Organization.objects.all().delete()
        if Organization.objects.filter(key="ACME").exists():
            self.stdout.write("Demo data already present.")
            return
        build_world(password=DEMO_PASSWORD)
        self.stdout.write(self.style.SUCCESS("Demo data loaded."))
