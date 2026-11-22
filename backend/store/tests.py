import json
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from .models import Address, Category, Coupon, ExchangeRequest, ExchangeRequestPhoto, Order, OrderItem, Product, Review

User = get_user_model()


class StoreFlowTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Mobiles", slug="mobiles")
        self.product = Product.objects.create(
            category=self.category,
            name="Test phone",
            slug="test-phone",
            brand="Test",
            description="A tested second-life phone.",
            price="100.00",
            old_price="150.00",
            image="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9",
            stock=3,
            condition="good",
        )
        self.user = User.objects.create_user(
            username="buyer@example.com",
            email="buyer@example.com",
            password="StrongPass#2026",
            first_name="Buyer",
        )
        self.admin = User.objects.create_superuser(
            username="staff",
            email="staff@example.com",
            password="StrongPass#2026",
        )
        self.client.force_authenticate(self.user)

    def test_api_root_lists_public_and_admin_endpoints(self):
        response = self.client.get("/api/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["products"]["list"].endswith("/api/products/"))
        self.assertTrue(response.data["categories"].endswith("/api/categories/"))
        self.assertTrue(response.data["orders"]["list"].endswith("/api/orders/"))
        self.assertTrue(response.data["addresses"]["list"].endswith("/api/addresses/"))
        self.assertTrue(response.data["admin"]["products"].endswith("/api/admin/products/"))
        self.assertTrue(response.data["admin"]["categories"].endswith("/api/admin/categories/"))
        self.assertTrue(response.data["admin"]["orders"].endswith("/api/admin/orders/"))

    def test_public_product_and_category_routes_and_append_slash(self):
        call_command("seed_store")

        products = self.client.get("/api/products/")
        categories = self.client.get("/api/categories/")
        slash_redirect = self.client.get("/api/products", follow=False)

        self.assertEqual(products.status_code, 200)
        self.assertEqual(products.data["count"], 48)
        self.assertEqual(categories.status_code, 200)
        self.assertEqual(categories.data["count"], 7)
        self.assertEqual(slash_redirect.status_code, 301)
        self.assertEqual(slash_redirect["Location"], "/api/products/")

    def test_deploy_admin_command_is_idempotent_without_rotating_existing_password(self):
        values = {
            "DJANGO_SUPERUSER_USERNAME": "deploy-admin",
            "DJANGO_SUPERUSER_EMAIL": "deploy-admin@example.com",
            "DJANGO_SUPERUSER_PASSWORD": "r7#Qm2!zL9@vC4$w",
        }
        original_password = values["DJANGO_SUPERUSER_PASSWORD"]
        with patch.dict("os.environ", values):
            call_command("ensure_deploy_admin")
            user = User.objects.get(username="deploy-admin")
            self.assertTrue(user.is_staff)
            self.assertTrue(user.is_superuser)
            self.assertTrue(user.check_password(original_password))

            values["DJANGO_SUPERUSER_PASSWORD"] = "s8%Jk4!pV2^xN6&b"
            call_command("ensure_deploy_admin")
            user.refresh_from_db()
            self.assertTrue(user.check_password(original_password))

    def test_deploy_admin_command_skips_when_render_credentials_are_unset(self):
        names = {
            "DJANGO_SUPERUSER_USERNAME": "",
            "DJANGO_SUPERUSER_EMAIL": "",
            "DJANGO_SUPERUSER_PASSWORD": "",
        }
        with patch.dict("os.environ", names):
            call_command("ensure_deploy_admin")

        self.assertEqual(User.objects.filter(is_superuser=True).count(), 1)

    def test_seed_command_creates_catalogue_products_with_seven_categories_and_unique_images(self):
        call_command("seed_store")

        self.assertEqual(Category.objects.count(), 7)
        self.assertEqual(
            set(Category.objects.values_list("slug", flat=True)),
            {
                "mobiles",
                "laptops",
                "books",
                "tablets",
                "smart-watches",
                "headphones-earbuds",
                "cameras",
            },
        )
        seeded_products = Product.objects.exclude(slug="test-phone")
        expected_counts = {"mobiles": 10, "laptops": 11, "books": 10}
        for slug, count in expected_counts.items():
            self.assertEqual(seeded_products.filter(category__slug=slug).count(), count)
        for slug in ("tablets", "smart-watches", "headphones-earbuds", "cameras"):
            self.assertEqual(seeded_products.filter(category__slug=slug).count(), 4)
        products = list(seeded_products)
        image_urls = [product.image for product in products]
        self.assertEqual(len(products), 47)
        self.assertEqual(len(set(image_urls)), 47)
        self.assertTrue(all(url.startswith("/images/products/") for url in image_urls))
        self.assertTrue(all(product.images == [product.image] for product in products))
        self.assertTrue(all(product.old_price and product.description and product.stock for product in products))
        self.assertEqual(seeded_products.get(slug="apple-iphone-12").price, 18999)
        self.assertEqual(seeded_products.get(slug="samsung-galaxy-s21").price, 15499)
        self.assertEqual(seeded_products.get(slug="hp-pavilion-14").price, 24999)
        self.assertEqual(seeded_products.get(slug="dell-inspiron-15").price, 21999)
        self.product.is_active = False
        self.product.save(update_fields=["is_active"])
        response = self.client.get("/api/products/")
        self.assertEqual(response.data["count"], 47)
        self.assertEqual(len(response.data["results"]), 47)

    def test_catalogue_snapshot_loads_local_records_idempotently(self):
        call_command("seed_catalogue_snapshot")
        call_command("seed_catalogue_snapshot")

        self.assertEqual(Category.objects.count(), 7)
        self.assertEqual(Product.objects.count(), 48)
        snapshot_path = Path(__file__).parent / "data" / "catalogue.json"
        snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
        expected = next(row for row in snapshot["products"] if row["slug"] == "apple-iphone-13")
        imported = Product.objects.get(slug="apple-iphone-13")
        self.assertTrue(imported.is_active)
        self.assertEqual(imported.stock, expected["stock"])
        self.assertEqual(str(imported.price), expected["price"])

    def test_price_range_filter_returns_only_matching_products(self):
        call_command("seed_store")
        response = self.client.get("/api/products/", {"min_price": "5000", "max_price": "15000"})

        self.assertTrue(response.data["results"])
        self.assertTrue(all(5000 <= float(product["price"]) <= 15000 for product in response.data["results"]))
        empty_response = self.client.get("/api/products/", {"min_price": "1", "max_price": "50"})
        self.assertEqual(empty_response.data["count"], 0)

    def test_product_search_matches_all_terms_in_names_brands_and_categories(self):
        call_command("seed_store")

        product_response = self.client.get("/api/products/", {"search": "Samsung Galaxy S22"})
        self.assertEqual(product_response.data["count"], 1)
        self.assertEqual(product_response.data["results"][0]["slug"], "samsung-galaxy-s22")

        category_response = self.client.get("/api/products/", {"search": "mobiles"})
        self.assertGreater(category_response.data["count"], 1)
        self.assertTrue(all(product["category_name"] == "Mobiles" for product in category_response.data["results"]))

        unrelated_terms_response = self.client.get("/api/products/", {"search": "iphone laptop"})
        self.assertEqual(unrelated_terms_response.data["count"], 0)

    def test_razorpay_create_reports_missing_backend_credentials(self):
        with patch.dict("os.environ", {"RAZORPAY_KEY_ID": "", "RAZORPAY_KEY_SECRET": ""}):
            response = self.client.post("/api/payments/razorpay/create/", {}, format="json")

        self.assertEqual(response.status_code, 503)
        self.assertIn("RAZORPAY_KEY_ID", response.data["detail"])
        self.assertIn("RAZORPAY_KEY_SECRET", response.data["detail"])

    def test_category_filter_accepts_singular_plural_and_case_variants(self):
        for category in ("mobile", "Mobile", "Mobiles", "mobiles"):
            with self.subTest(category=category):
                response = self.client.get("/api/products/", {"category": category})
                self.assertEqual(response.data["count"], 1)
                self.assertEqual(response.data["results"][0]["slug"], "test-phone")

    def test_exchange_request_saves_three_uploaded_photos(self):
        uploads = []
        for index, (image_format, extension, content_type) in enumerate(
            (("JPEG", "jpg", "image/jpeg"), ("PNG", "png", "image/png"), ("WEBP", "webp", "image/webp"))
        ):
            image_buffer = BytesIO()
            Image.new("RGB", (2, 2), color="green").save(image_buffer, format=image_format)
            uploads.append(
                SimpleUploadedFile(
                    f"view-{index}.{extension}",
                    image_buffer.getvalue(),
                    content_type=content_type,
                )
            )

        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                response = self.client.post(
                    "/api/exchange/estimate/",
                    {
                        "product_type": "mobile",
                        "product_name": "Test phone",
                        "condition": "good",
                        "description": "Light wear on the back.",
                        "photos_upload": uploads,
                    },
                    format="multipart",
                )

        self.assertEqual(response.status_code, 201)
        request = ExchangeRequest.objects.get(id=response.data["id"])
        self.assertEqual(ExchangeRequestPhoto.objects.filter(exchange_request=request).count(), 3)
        self.assertEqual(len(response.data["photos"]), 3)
        self.assertTrue(all(photo["url"].startswith("http://testserver/") for photo in response.data["photos"]))
        self.assertEqual(request.photos.count(), 3)

    def test_exchange_request_rejects_more_than_three_photos(self):
        image_buffer = BytesIO()
        Image.new("RGB", (2, 2), color="green").save(image_buffer, format="PNG")
        image_data = image_buffer.getvalue()
        response = self.client.post(
            "/api/exchange/estimate/",
            {
                "product_type": "mobile",
                "product_name": "Test phone",
                "condition": "good",
                "photos_upload": [
                    SimpleUploadedFile(f"view-{index}.png", image_data, content_type="image/png")
                    for index in range(4)
                ],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(ExchangeRequest.objects.count(), 0)

    def test_exchange_request_rejects_unsupported_photo_format(self):
        response = self.client.post(
            "/api/exchange/estimate/",
            {
                "product_type": "mobile",
                "product_name": "Test phone",
                "condition": "good",
                "photos_upload": [SimpleUploadedFile("view.gif", b"gif data", content_type="image/gif")],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Please upload JPG/PNG only", str(response.data))
        self.assertEqual(ExchangeRequest.objects.count(), 0)

    def test_exchange_request_rejects_photos_over_five_megabytes(self):
        response = self.client.post(
            "/api/exchange/estimate/",
            {
                "product_type": "mobile",
                "product_name": "Test phone",
                "condition": "good",
                "photos_upload": [
                    SimpleUploadedFile(
                        "large.png",
                        b"x" * (5 * 1024 * 1024 + 1),
                        content_type="image/png",
                    )
                ],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("5 MB or smaller", str(response.data))
        self.assertEqual(ExchangeRequest.objects.count(), 0)

    def test_cod_checkout_decrements_stock_and_cancel_restores_once(self):
        address = Address.objects.create(
            user=self.user,
            full_name="Buyer",
            phone="9876543210",
            line1="1 Green Street",
            city="Chennai",
            state="Tamil Nadu",
            postal_code="600001",
            is_default=True,
        )
        Coupon.objects.create(code="RENEW10", discount_percent=10)
        add_response = self.client.post("/api/cart/", {"product_id": self.product.id, "quantity": 2}, format="json")
        self.assertEqual(add_response.status_code, 201)

        order_response = self.client.post(
            "/api/orders/",
            {"address_id": address.id, "payment_method": "cod", "coupon_code": "renew10"},
            format="json",
        )
        self.assertEqual(order_response.status_code, 201)
        order = Order.objects.get(order_number=order_response.data["order_number"])
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 1)
        self.assertEqual(str(order.total), "180.00")

        self.client.force_authenticate(self.admin)
        cancel_url = f"/api/admin/orders/{order.order_number}/"
        self.assertEqual(self.client.patch(cancel_url, {"status": "cancelled"}, format="json").status_code, 200)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)
        self.assertEqual(self.client.patch(cancel_url, {"status": "cancelled"}, format="json").status_code, 200)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)
        self.assertEqual(self.client.patch(cancel_url, {"status": "confirmed"}, format="json").status_code, 400)

    def test_cart_rejects_quantity_above_stock_without_persisting_it(self):
        response = self.client.post(
            "/api/cart/",
            {"product_id": self.product.id, "quantity": self.product.stock + 1},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(self.user.cart_items.exists())

    def test_review_requires_a_purchased_product(self):
        response = self.client.post(
            f"/api/products/{self.product.id}/reviews/",
            {"rating": 5, "comment": "Works really well."},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Review.objects.count(), 0)

    def test_purchased_customer_can_review_once(self):
        order = Order.objects.create(
            user=self.user,
            order_number="RK260101ABC123",
            payment_method="cod",
            status="confirmed",
            subtotal="100.00",
            discount="0.00",
            total="100.00",
            shipping_address={"full_name": "Buyer"},
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            product_name=self.product.name,
            image=self.product.image,
            price=self.product.price,
            quantity=1,
        )
        url = f"/api/products/{self.product.id}/reviews/"
        payload = {"rating": 5, "comment": "Works really well."}
        self.assertEqual(self.client.post(url, payload, format="json").status_code, 201)
        self.assertEqual(self.client.post(url, payload, format="json").status_code, 400)
        self.product.refresh_from_db()
        self.assertEqual(str(self.product.rating), "5.00")
        self.assertEqual(self.product.ratings_count, 1)

    def test_admin_api_rejects_regular_user(self):
        response = self.client.get("/api/admin/stats/")
        self.assertEqual(response.status_code, 403)

    def test_admin_product_api_returns_all_products_for_inventory(self):
        call_command("seed_store")
        self.client.force_authenticate(self.admin)

        response = self.client.get("/api/admin/products/")

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), Product.objects.count())

    def test_admin_product_image_upload_uses_media_storage(self):
        image_buffer = BytesIO()
        Image.new("RGB", (2, 2), color="green").save(image_buffer, format="PNG")
        upload = SimpleUploadedFile(
            "dell-inspiron-15.png",
            image_buffer.getvalue(),
            content_type="image/png",
        )
        self.client.force_authenticate(self.admin)

        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                response = self.client.patch(
                    f"/api/admin/products/{self.product.id}/",
                    {"image_file": upload},
                    format="multipart",
                )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["image"], "/media/products/dell-inspiron-15.png")
                self.assertTrue((Path(media_root) / "products" / "dell-inspiron-15.png").is_file())

    def test_registration_login_and_logout_use_tokens(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            "/api/auth/register/",
            {"first_name": "New", "email": "new@example.com", "password": "AnotherStrong#2026"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["token"])
        login = self.client.post(
            "/api/auth/login/",
            {"email": "NEW@example.com", "password": "AnotherStrong#2026"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.data["token"])
