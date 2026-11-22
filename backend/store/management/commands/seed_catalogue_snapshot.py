import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_datetime

from store.models import Category, Product


SNAPSHOT_PATH = Path(__file__).resolve().parents[2] / "data" / "catalogue.json"


class Command(BaseCommand):
    help = "Load the checked-in local catalogue snapshot idempotently."

    def handle(self, *args, **options):
        try:
            snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise CommandError(f"Unable to read catalogue snapshot at {SNAPSHOT_PATH}: {exc}") from exc

        categories = snapshot.get("categories")
        products = snapshot.get("products")
        if snapshot.get("version") != 1 or not isinstance(categories, list) or not isinstance(products, list):
            raise CommandError("Catalogue snapshot has an unsupported version or invalid data.")

        category_by_slug = {}
        with transaction.atomic():
            for row in categories:
                slug = row.get("slug")
                if not slug:
                    raise CommandError("Every snapshot category must have a slug.")
                category, _ = Category.objects.update_or_create(
                    slug=slug,
                    defaults={
                        "name": row["name"],
                        "description": row.get("description", ""),
                        "image": row.get("image", ""),
                    },
                )
                created_at = parse_datetime(row.get("created_at", ""))
                if created_at:
                    Category.objects.filter(pk=category.pk).update(created_at=created_at)
                category_by_slug[slug] = category

            for row in products:
                slug = row.get("slug")
                category = category_by_slug.get(row.get("category_slug"))
                if not slug or category is None:
                    raise CommandError(f"Product {slug or '<unknown>'} has no matching snapshot category.")

                product, _ = Product.objects.update_or_create(
                    slug=slug,
                    defaults={
                        "category": category,
                        "name": row["name"],
                        "brand": row.get("brand", ""),
                        "description": row["description"],
                        "price": row["price"],
                        "old_price": row.get("old_price"),
                        "image": row.get("image", ""),
                        "image_upload": row.get("image_upload"),
                        "images": row.get("images") or [],
                        "stock": row["stock"],
                        "condition": row["condition"],
                        "warranty": row["warranty"],
                        "rating": row.get("rating", "0"),
                        "ratings_count": row.get("ratings_count", 0),
                        "is_active": row.get("is_active", True),
                    },
                )
                created_at = parse_datetime(row.get("created_at", ""))
                if created_at:
                    Product.objects.filter(pk=product.pk).update(created_at=created_at)

        self.stdout.write(
            self.style.SUCCESS(
                f"Catalogue snapshot loaded: {len(categories)} categories, {len(products)} products."
            )
        )
