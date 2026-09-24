from django.conf import settings
from django.db import models


class Status(models.TextChoices):
    OPEN = "open", "Open"
    IN_PROGRESS = "in_progress", "In progress"
    WAITING = "waiting", "Waiting for client"
    RESOLVED = "resolved", "Resolved"
    CLOSED = "closed", "Closed"


class Visibility(models.TextChoices):
    PUBLIC = "public", "Public"
    INTERNAL = "internal", "Internal"


class Ticket(models.Model):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="tickets")
    number = models.PositiveIntegerField()
    subject = models.CharField(max_length=200)
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="requested_tickets")
    handler = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="handled_tickets"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["organization", "number"], name="unique_ticket_number")]
        indexes = [models.Index(fields=["requester"]), models.Index(fields=["organization", "status"])]

    def __str__(self) -> str:
        return self.key

    @property
    def key(self) -> str:
        return f"{self.organization.key}-{self.number}"


class Event(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="events")
    visibility = models.CharField(max_length=10, choices=Visibility.choices)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="+")
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["ticket", "id"])]

    def __str__(self) -> str:
        return f"{self.ticket.key} #{self.pk} ({self.visibility})"
