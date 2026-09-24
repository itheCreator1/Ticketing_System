from django.contrib.auth.base_user import BaseUserManager


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email: str, password: str | None = None, **fields):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=email.strip().lower(), **fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str | None = None, **fields):
        fields.setdefault("role", "superadmin")
        fields.setdefault("display_name", email)
        return self.create_user(email, password, **fields)
