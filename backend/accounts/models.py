from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q

from .managers import UserManager


class Role(models.TextChoices):
    SUPERADMIN = "superadmin", "Superadmin"
    ADMIN = "admin", "Admin"
    CUSTOMER_MANAGER = "customer_manager", "Customer manager"
    CUSTOMER_USER = "customer_user", "Customer user"


STAFF_ROLES = (Role.SUPERADMIN, Role.ADMIN)
CUSTOMER_ROLES = (Role.CUSTOMER_MANAGER, Role.CUSTOMER_USER)


class User(AbstractUser):
    username = None  # type: ignore[assignment]
    first_name = None  # type: ignore[assignment]
    last_name = None  # type: ignore[assignment]
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=150)
    role = models.CharField(max_length=20, choices=Role.choices)
    organization = models.ForeignKey(
        "organizations.Organization", null=True, blank=True, on_delete=models.PROTECT, related_name="members"
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["display_name"]
    objects = UserManager()  # type: ignore[misc]

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(role__in=[r.value for r in STAFF_ROLES], organization__isnull=True)
                    | Q(role__in=[r.value for r in CUSTOMER_ROLES], organization__isnull=False)
                ),
                name="user_role_matches_organization",
            )
        ]

    @property
    def is_staff_member(self) -> bool:
        return self.role in STAFF_ROLES
