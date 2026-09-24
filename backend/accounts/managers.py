from typing import TYPE_CHECKING

from django.contrib.auth.base_user import BaseUserManager

if TYPE_CHECKING:
    from .models import User


class UserManager(BaseUserManager["User"]):
    use_in_migrations = True

    def create_user(self, email: str, password: str | None = None, **fields) -> "User":
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=email.strip().lower(), **fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user
