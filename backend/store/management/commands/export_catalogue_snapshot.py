import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from store.models import Category, Product


DEFAULT_SNAPSHOT_PATH = Path(__file__).resolve().parents[2] / "data" / "catalogue.json"


class Command(BaseCommand):
    help = "Export all categories and products from the configured database."

    def add_arguments(self, parser):
        parser.add_argument("--output", default=str(DEFAULT_SNAPSHOT_PATH))

    def handle(self, *args, **options):
        uploaded_products = Product.objects.exclude(image_upload="").count()
        if uploaded_products:
            raise CommandError(
                f"{uploaded_products} product(s) use uploaded image files. "
                "Copy those media files to durable deployment storage before exporting."
            )

        categories = [
            {
                "name": category.name,
                "slug": category.slug,
                "description": category.description,
                "image": category.image,
                "created_at": category.created_at.isoformat(),
            }
            for category in Category.objects.order_by("slug")
        ]
        products = [
            {
                "category_slug": product.category.slug,
                "name": product.name,
                "slug": product.slug,
                "brand": product.brand,
                "description": product.description,
                "price": str(product.price),
                "old_price": str(product.old_price) if product.old_price is not None else None,
                "image": product.image,
                "images": product.images,
                "image_upload": None,
                "stock": product.stock,
                "condition": product.condition,
                "warranty": product.warranty,
                "rating": str(product.rating),
                "ratings_count": product.ratings_count,
                "created_at": product.created_at.isoformat(),
                "is_active": product.is_active,
            }
            for product in Product.objects.select_related("category").order_by("slug")
        ]
        snapshot = {
            "version": 1,
            "categories": categories,
            "products": products,
        }

        output_path = Path(options["output"]).resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Exported {len(categories)} categories and {len(products)} products "
                f"to {output_path}."
            )
        )
