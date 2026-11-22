import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Create or enable the deployment administrator from environment variables."

    def handle(self, *args, **options):
        username = os.getenv("DJANGO_SUPERUSER_USERNAME", "").strip()
        email = os.getenv("DJANGO_SUPERUSER_EMAIL", "").strip()
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD", "")
        if not username or not email or not password:
            self.stderr.write(
                self.style.WARNING(
                    "Deployment administrator provisioning skipped; set "
                    "DJANGO_SUPERUSER_USERNAME, DJANGO_SUPERUSER_EMAIL, and "
                    "DJANGO_SUPERUSER_PASSWORD to enable it."
                )
            )
            return

        User = get_user_model()
        validate_password(password, User(username=username, email=email))

        with transaction.atomic():
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "is_active": True,
                    "is_staff": True,
                    "is_superuser": True,
                },
            )
            user.email = email
            user.is_active = True
            user.is_staff = True
            user.is_superuser = True
            if created:
                user.set_password(password)
            user.save()

        self.stdout.write(
            self.style.SUCCESS(
                "Deployment administrator created."
                if created
                else "Deployment administrator verified."
            )
        )
