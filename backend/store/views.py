import logging
import os
import uuid
from datetime import datetime
from decimal import Decimal

import razorpay
import requests
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, F, Q, Sum
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.text import slugify
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions, status, viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.reverse import reverse
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Address,
    CartItem,
    Category,
    ContactMessage,
    Coupon,
    ExchangeRequest,
    Order,
    OrderItem,
    Product,
    Review,
    WishlistItem,
)
from .serializers import (
    AddressSerializer,
    CartItemSerializer,
    CategorySerializer,
    ContactMessageSerializer,
    CouponSerializer,
    ExchangeRequestSerializer,
    OrderSerializer,
    ProductSerializer,
    RegisterSerializer,
    ReviewSerializer,
    UserSerializer,
    WishlistSerializer,
)

logger = logging.getLogger(__name__)
User = get_user_model()


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def api_root(request):
    return Response({
        "auth": {
            "register": reverse("register", request=request),
            "login": reverse("login", request=request),
            "logout": reverse("logout", request=request),
            "forgot_password": reverse("forgot-password", request=request),
            "reset_password": reverse("reset-password", request=request),
        },
        "profile": reverse("profile", request=request),
        "categories": reverse("categories", request=request),
        "products": {
            "list": reverse("products", request=request),
            "detail_pattern": "/api/products/<slug>/",
            "reviews_pattern": "/api/products/<product_id>/reviews/",
        },
        "featured_reviews": reverse("featured-reviews", request=request),
        "cart": reverse("cart", request=request),
        "wishlist": reverse("wishlist", request=request),
        "addresses": {
            "list": reverse("address-list", request=request),
            "detail_pattern": "/api/addresses/<id>/",
        },
        "coupons": {
            "check": reverse("coupon-check", request=request),
            "admin": reverse("admin-coupon-list", request=request),
        },
        "orders": {
            "list": reverse("orders", request=request),
            "detail_pattern": "/api/orders/<order_number>/",
        },
        "payments": {
            "razorpay_create": reverse("razorpay-create", request=request),
            "razorpay_verify": reverse("razorpay-verify", request=request),
        },
        "exchange_estimate": reverse("exchange-estimate", request=request),
        "contact": reverse("contact", request=request),
        "admin": {
            "stats": reverse("admin-stats", request=request),
            "products": reverse("admin-product-list", request=request),
            "product_detail_pattern": "/api/admin/products/<id>/",
            "categories": reverse("admin-category-list", request=request),
            "category_detail_pattern": "/api/admin/categories/<id>/",
            "orders": reverse("admin-order-list", request=request),
            "order_detail_pattern": "/api/admin/orders/<order_number>/",
            "coupons": reverse("admin-coupon-list", request=request),
            "users": reverse("admin-user-list", request=request),
        },
    })


def _razorpay_client():
    key_id = os.getenv("RAZORPAY_KEY_ID", "").strip()
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
    if not key_id or not key_secret:
        return None, None
    return razorpay.Client(auth=(key_id, key_secret)), key_id


@transaction.atomic
def _create_order(user, address, payment_method, coupon_code=""):
    items = list(CartItem.objects.select_related("product").select_for_update().filter(user=user))
    if not items:
        raise ValueError("Your cart is empty.")
    for item in items:
        if item.quantity > item.product.stock:
            raise ValueError(f"Only {item.product.stock} left for {item.product.name}.")

    subtotal = sum((item.product.price * item.quantity for item in items), Decimal("0.00"))
    discount = Decimal("0.00")
    coupon = None
    if coupon_code:
        try:
            coupon = Coupon.objects.get(code__iexact=coupon_code.strip())
        except Coupon.DoesNotExist as exc:
            raise ValueError("That coupon code is not valid.") from exc
        if not coupon.is_valid():
            raise ValueError("That coupon has expired or is inactive.")
        discount = (subtotal * Decimal(coupon.discount_percent) / Decimal("100")).quantize(Decimal("0.01"))

    address_data = AddressSerializer(address).data
    order = Order.objects.create(
        user=user,
        order_number=f"RK{timezone.now():%y%m%d}{uuid.uuid4().hex[:6].upper()}",
        payment_method=payment_method,
        payment_status="pending",
        subtotal=subtotal,
        discount=discount,
        total=subtotal - discount,
        coupon_code=coupon.code if coupon else "",
        shipping_address=address_data,
    )
    for item in items:
        product = item.product
        changed = Product.objects.filter(pk=product.pk, stock__gte=item.quantity).update(stock=F("stock") - item.quantity)
        if not changed:
            raise ValueError(f"{product.name} is no longer available in that quantity.")
        OrderItem.objects.create(
            order=order,
            product=product,
            product_name=product.name,
            image=product.image,
            price=product.price,
            quantity=item.quantity,
        )
    CartItem.objects.filter(user=user).delete()
    return order


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        user = User.objects.create_user(
            username=values["email"].lower(),
            email=values["email"].lower(),
            first_name=values["first_name"],
            last_name=values.get("last_name", ""),
            password=values["password"],
        )
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        password = request.data.get("password", "")
        account = User.objects.filter(email__iexact=email).first()
        user = authenticate(request, username=account.username, password=password) if account else None
        if user is None:
            return Response({"detail": "Email or password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data})


class LogoutView(APIView):
    def post(self, request):
        request.auth.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProfileView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip()
        if email:
            for user in User.objects.filter(email__iexact=email, is_active=True):
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)
                frontend = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
                reset_link = f"{frontend}/reset-password/{uid}/{token}"
                send_mail(
                    "Reset your ReNewKart password",
                    f"Use this one-time link to reset your password:\n\n{reset_link}\n\nIf you did not request a reset, you can ignore this email.",
                    None,
                    [user.email],
                    fail_silently=False,
                )
        return Response({"detail": "If that email is registered, reset instructions have been sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uid = request.data.get("uid", "")
        token = request.data.get("token", "")
        password = request.data.get("password", "")
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)), is_active=True)
        except (User.DoesNotExist, TypeError, ValueError, OverflowError):
            return Response({"detail": "This password reset link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)
        if not default_token_generator.check_token(user, token):
            return Response({"detail": "This password reset link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(password, user)
        except DjangoValidationError as exc:
            return Response({"password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(password)
        user.save(update_fields=["password"])
        Token.objects.filter(user=user).delete()
        return Response({"detail": "Your password has been updated. Sign in with your new password."})


class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]


class ProductPagination(PageNumberPagination):
    page_size = 100


class ProductListView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = ProductPagination

    def get_queryset(self):
        queryset = Product.objects.filter(is_active=True, stock__gte=0).select_related("category")
        params = self.request.query_params
        search = params.get("search", "").strip()
        for term in search.split():
            queryset = queryset.filter(
                Q(name__icontains=term)
                | Q(brand__icontains=term)
                | Q(category__name__icontains=term)
            )
        category = params.get("category", "").strip()
        if category:
            category_aliases = {
                "mobile": "mobiles",
                "mobiles": "mobiles",
                "phone": "mobiles",
                "phones": "mobiles",
                "laptop": "laptops",
                "laptops": "laptops",
                "tablet": "tablets",
                "tablets": "tablets",
            }
            category_slug = category_aliases.get(slugify(category).lower(), slugify(category).lower())
            queryset = queryset.filter(
                Q(category__slug__iexact=category_slug) | Q(category__name__iexact=category)
            )
        if params.get("brand"):
            queryset = queryset.filter(brand__iexact=params["brand"])
        if params.get("condition"):
            queryset = queryset.filter(condition=params["condition"])
        if params.get("min_price"):
            queryset = queryset.filter(price__gte=params["min_price"])
        if params.get("max_price"):
            queryset = queryset.filter(price__lte=params["max_price"])
        ordering = params.get("sort")
        ordering_map = {
            "price_asc": "price",
            "price_desc": "-price",
            "newest": "-created_at",
            "rating": "-rating",
        }
        if ordering in ordering_map:
            queryset = queryset.order_by(ordering_map[ordering])
        return queryset


class ProductDetailView(generics.RetrieveAPIView):
    queryset = Product.objects.filter(is_active=True).select_related("category").prefetch_related("reviews__user")
    serializer_class = ProductSerializer
    lookup_field = "slug"
    permission_classes = [permissions.AllowAny]

    def retrieve(self, request, *args, **kwargs):
        product = self.get_object()
        data = self.get_serializer(product).data
        data["reviews"] = ReviewSerializer(product.reviews.all(), many=True).data
        return Response(data)


class CartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        items = CartItem.objects.filter(user=request.user).select_related("product__category")
        return Response(CartItemSerializer(items, many=True).data)

    def post(self, request):
        serializer = CartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.validated_data["product"]
        quantity = serializer.validated_data.get("quantity", 1)
        if quantity > product.stock:
            return Response({"detail": f"Only {product.stock} left in stock."}, status=status.HTTP_400_BAD_REQUEST)
        item, created = CartItem.objects.get_or_create(user=request.user, product=product, defaults={"quantity": quantity})
        if not created:
            item.quantity += quantity
        if item.quantity > product.stock:
            return Response({"detail": f"Only {product.stock} left in stock."}, status=status.HTTP_400_BAD_REQUEST)
        item.save()
        return Response(CartItemSerializer(item).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def patch(self, request):
        item = generics.get_object_or_404(CartItem, pk=request.data.get("item_id"), user=request.user)
        quantity = request.data.get("quantity")
        if not isinstance(quantity, int) or quantity < 1:
            return Response({"detail": "Quantity must be at least one."}, status=status.HTTP_400_BAD_REQUEST)
        if quantity > item.product.stock:
            return Response({"detail": f"Only {item.product.stock} left in stock."}, status=status.HTTP_400_BAD_REQUEST)
        item.quantity = quantity
        item.save(update_fields=["quantity"])
        return Response(CartItemSerializer(item).data)

    def delete(self, request):
        generics.get_object_or_404(CartItem, pk=request.query_params.get("item_id"), user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WishlistView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        items = WishlistItem.objects.filter(user=request.user).select_related("product__category")
        return Response(WishlistSerializer(items, many=True).data)

    def post(self, request):
        product = generics.get_object_or_404(Product, pk=request.data.get("product_id"), is_active=True)
        item, created = WishlistItem.objects.get_or_create(user=request.user, product=product)
        return Response(WishlistSerializer(item).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request):
        generics.get_object_or_404(WishlistItem, pk=request.query_params.get("item_id"), user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        if serializer.validated_data.get("is_default"):
            Address.objects.filter(user=self.request.user).update(is_default=False)
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        if serializer.validated_data.get("is_default"):
            Address.objects.filter(user=self.request.user).exclude(pk=self.get_object().pk).update(is_default=False)
        serializer.save()


class CouponCheckView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            coupon = Coupon.objects.get(code__iexact=str(request.data.get("code", "")).strip())
        except Coupon.DoesNotExist:
            return Response({"detail": "That coupon code is not valid."}, status=status.HTTP_400_BAD_REQUEST)
        if not coupon.is_valid():
            return Response({"detail": "That coupon has expired or is inactive."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CouponSerializer(coupon).data)


class OrderListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        orders = Order.objects.filter(user=request.user).prefetch_related("items")
        return Response(OrderSerializer(orders, many=True).data)

    @transaction.atomic
    def post(self, request):
        if request.data.get("payment_method") != "cod":
            return Response({"detail": "Use the Razorpay payment endpoint for online payments."}, status=status.HTTP_400_BAD_REQUEST)
        address = generics.get_object_or_404(Address, pk=request.data.get("address_id"), user=request.user)
        try:
            order = _create_order(request.user, address, "cod", request.data.get("coupon_code", ""))
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderDetailView(generics.RetrieveAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return Order.objects.all().prefetch_related("items")
        return Order.objects.filter(user=self.request.user).prefetch_related("items")

    lookup_field = "order_number"


class RazorpayCreateOrderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        client, key_id = _razorpay_client()
        if client is None:
            return Response(
                {
                    "detail": (
                        "Razorpay is not configured. Set both RAZORPAY_KEY_ID and "
                        "RAZORPAY_KEY_SECRET in the backend environment."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        address = generics.get_object_or_404(Address, pk=request.data.get("address_id"), user=request.user)
        try:
            order = _create_order(request.user, address, "razorpay", request.data.get("coupon_code", ""))
            provider_order = client.order.create({"amount": int(order.total * 100), "currency": "INR", "receipt": order.order_number})
            order.razorpay_order_id = provider_order["id"]
            order.save(update_fields=["razorpay_order_id"])
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except (
            razorpay.errors.BadRequestError,
            razorpay.errors.GatewayError,
            razorpay.errors.ServerError,
            requests.exceptions.RequestException,
        ):
            logger.exception("Razorpay order creation failed")
            transaction.set_rollback(True)
            return Response({"detail": "Razorpay could not create the payment order. Please try again."}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({
            "order": OrderSerializer(order).data,
            "razorpay_order_id": provider_order["id"],
            "key_id": key_id,
            "amount": int(order.total * 100),
            "currency": "INR",
            "name": f"{request.user.first_name} {request.user.last_name}".strip() or request.user.email,
            "email": request.user.email,
        }, status=status.HTTP_201_CREATED)


class RazorpayVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        client, _ = _razorpay_client()
        if client is None:
            return Response(
                {
                    "detail": (
                        "Razorpay is not configured. Set both RAZORPAY_KEY_ID and "
                        "RAZORPAY_KEY_SECRET in the backend environment."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        order = generics.get_object_or_404(
            Order, order_number=request.data.get("order_number"), user=request.user, payment_method="razorpay"
        )
        signature_data = {
            "razorpay_order_id": request.data.get("razorpay_order_id", ""),
            "razorpay_payment_id": request.data.get("razorpay_payment_id", ""),
            "razorpay_signature": request.data.get("razorpay_signature", ""),
        }
        if signature_data["razorpay_order_id"] != order.razorpay_order_id:
            return Response({"detail": "Payment order does not match."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            client.utility.verify_payment_signature(signature_data)
        except razorpay.errors.SignatureVerificationError:
            return Response({"detail": "Payment signature verification failed."}, status=status.HTTP_400_BAD_REQUEST)
        order.payment_status = "paid"
        order.status = "confirmed"
        order.save(update_fields=["payment_status", "status"])
        return Response(OrderSerializer(order).data)


class ReviewListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request, product_id):
        product = generics.get_object_or_404(Product, pk=product_id)
        return Response(ReviewSerializer(product.reviews.all(), many=True).data)

    def post(self, request, product_id):
        product = generics.get_object_or_404(Product, pk=product_id)
        purchase_item = OrderItem.objects.filter(
            product=product, order__user=request.user, order__status__in=["confirmed", "shipped", "delivered"]
        ).select_related("order").first()
        if not purchase_item:
            return Response({"detail": "You can review this item after purchasing it."}, status=status.HTTP_403_FORBIDDEN)
        if Review.objects.filter(user=request.user, product=product).exists():
            return Response({"detail": "You have already reviewed this product."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                review = serializer.save(user=request.user, product=product, order=purchase_item.order)
        except IntegrityError:
            return Response({"detail": "You have already reviewed this product."}, status=status.HTTP_400_BAD_REQUEST)
        aggregates = product.reviews.aggregate(rating=Avg("rating"), count=Count("id"))
        Product.objects.filter(pk=product.pk).update(rating=aggregates["rating"], ratings_count=aggregates["count"])
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class FeaturedReviewsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        reviews = Review.objects.select_related("user", "product").all()[:6]
        return Response([
            {
                **ReviewSerializer(review).data,
                "product_name": review.product.name,
                "product_slug": review.product.slug,
            }
            for review in reviews
        ])


class ExchangeEstimateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request):
        serializer = ExchangeRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        base = Decimal("4000") if values["product_type"] == "mobile" else Decimal("12000")
        condition_factor = {"like_new": Decimal("0.8"), "good": Decimal("0.6"), "average": Decimal("0.4")}
        estimate = (base * condition_factor[values["condition"]]).quantize(Decimal("0.01"))
        submission = serializer.save(user=request.user, estimate=estimate)
        return Response(
            ExchangeRequestSerializer(submission, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ContactMessageView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ContactMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Your message has been received."}, status=status.HTTP_201_CREATED)


class AdminProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().select_related("category")
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAdminUser]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    pagination_class = None


class AdminCategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = None


class AdminOrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all().prefetch_related("items")
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = None
    lookup_field = "order_number"
    http_method_names = ["get", "patch", "head", "options"]

    def update(self, request, *args, **kwargs):
        order = self.get_object()
        new_status = request.data.get("status")
        valid = dict(Order.STATUS_CHOICES)
        if new_status not in valid:
            return Response({"detail": "Choose a valid order status."}, status=status.HTTP_400_BAD_REQUEST)
        if order.status == "cancelled" and new_status != "cancelled":
            return Response({"detail": "A cancelled order cannot be reopened."}, status=status.HTTP_400_BAD_REQUEST)
        if order.payment_status == "paid" and new_status == "cancelled" and order.status != "cancelled":
            return Response(
                {"detail": "Refund the Razorpay payment before cancelling this paid order."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_status == "cancelled" and order.status != "cancelled":
            with transaction.atomic():
                for item in order.items.all():
                    Product.objects.filter(pk=item.product_id).update(stock=F("stock") + item.quantity)
                order.status = "cancelled"
                order.save(update_fields=["status"])
        else:
            order.status = new_status
            order.save(update_fields=["status"])
        return Response(self.get_serializer(order).data)


class AdminCouponViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.all()
    serializer_class = CouponSerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = None


class AdminUserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = None

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        if user.is_staff:
            return Response({"detail": "Staff accounts cannot be blocked here."}, status=status.HTTP_400_BAD_REQUEST)
        user.is_active = bool(request.data.get("is_active", user.is_active))
        user.save(update_fields=["is_active"])
        return Response(self.get_serializer(user).data)


@api_view(["GET"])
@permission_classes([permissions.IsAdminUser])
def admin_stats(request):
    orders = Order.objects.all()
    monthly = []
    now = timezone.localtime()
    for offset in range(5, -1, -1):
        month_index = now.year * 12 + now.month - 1 - offset
        year, month_number = divmod(month_index, 12)
        month_number += 1
        month = datetime(year, month_number, 1, tzinfo=timezone.get_current_timezone())
        next_month_index = month_index + 1
        next_year, next_month_number = divmod(next_month_index, 12)
        next_month = datetime(next_year, next_month_number + 1, 1, tzinfo=timezone.get_current_timezone())
        qs = orders.filter(created_at__gte=month, created_at__lt=next_month)
        monthly.append({
            "month": month.strftime("%b"),
            "sales": float(qs.filter(payment_status__in=["paid", "pending"]).aggregate(total=Sum("total"))["total"] or 0),
            "orders": qs.count(),
        })
    return Response({
        "sales": orders.filter(payment_status__in=["paid", "pending"]).aggregate(total=Sum("total"))["total"] or 0,
        "orders": orders.count(),
        "products": Product.objects.count(),
        "users": User.objects.filter(is_staff=False).count(),
        "monthly": monthly,
        "recent_orders": OrderSerializer(orders[:5], many=True).data,
        "low_stock": Product.objects.filter(stock__lt=5, is_active=True).count(),
    })
