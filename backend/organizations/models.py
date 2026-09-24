from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q

KEY_PATTERN = r"^[A-Z]{2,10}$"


class Organization(models.Model):
    name = models.CharField(max_length=200, unique=True)
    key = models.CharField(
        max_length=10,
        unique=True,
        validators=[RegexValidator(KEY_PATTERN, "Use 2–10 uppercase letters.")],
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(key__regex=KEY_PATTERN), name="organization_key_format")]

    def __str__(self) -> str:
        return self.key

    def save(self, *args, **kwargs) -> None:
        creating = self._state.adding
        if not creating:
            stored = type(self).objects.filter(pk=self.pk).values_list("key", flat=True).first()
            if stored is not None and stored != self.key:
                raise ValueError("Organization key is immutable")
        super().save(*args, **kwargs)
        if creating:
            TicketCounter.objects.create(organization=self)


class TicketCounter(models.Model):
    organization = models.OneToOneField(
        Organization, primary_key=True, on_delete=models.CASCADE, related_name="ticket_counter"
    )
    last_number = models.PositiveIntegerField(default=0)
