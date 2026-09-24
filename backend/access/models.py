from django.conf import settings
from django.db import models

from accounts.models import CUSTOMER_ROLES, Role


class OrganizationGrant(models.Model):
    admin = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="organization_grants")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="grants")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["admin", "organization"], name="unique_organization_grant")]

    def __str__(self) -> str:
        return f"{self.admin.email} → {self.organization.key}"

    def save(self, *args, **kwargs) -> None:
        if self.admin.role != Role.ADMIN:
            raise ValueError("Only admin users receive grants")
        super().save(*args, **kwargs)


class PersonGrant(models.Model):
    admin = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="person_grants")
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="granted_to")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["admin", "customer"], name="unique_person_grant")]

    def __str__(self) -> str:
        return f"{self.admin.email} → {self.customer.email}"

    def save(self, *args, **kwargs) -> None:
        if self.admin.role != Role.ADMIN:
            raise ValueError("Only admin users receive grants")
        if self.customer.role not in CUSTOMER_ROLES:
            raise ValueError("A person grant must target a customer")
        super().save(*args, **kwargs)
