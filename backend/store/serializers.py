from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
import json
import os

from .models import (
    Address,
    CartItem,
    Category,
    ContactMessage,
    Coupon,
    ExchangeRequest,
    ExchangeRequestPhoto,
    Order,
    OrderItem,
    Product,
    Review,
    WishlistItem,
)

User = get_user_model()
MAX_EXCHANGE_PHOTO_SIZE = 5 * 1024 * 1024
EXCHANGE_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
EXCHANGE_PHOTO_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


def validate_exchange_photo_file(upload):
    if upload.size > MAX_EXCHANGE_PHOTO_SIZE:
        raise serializers.ValidationError("Each photo must be 5 MB or smaller.")
    if os.path.splitext(upload.name)[1].lower() not in EXCHANGE_PHOTO_EXTENSIONS:
        raise serializers.ValidationError("Please upload JPG/PNG only")
    content_type = getattr(upload, "content_type", None)
    if content_type and content_type.lower() not in EXCHANGE_PHOTO_CONTENT_TYPES:
        raise serializers.ValidationError("Please upload JPG/PNG only")


class ExchangePhotoListField(serializers.ListField):
    def __init__(self, **kwargs):
        super().__init__(child=serializers.ImageField(), max_length=3, **kwargs)

    def get_value(self, dictionary):
        if hasattr(dictionary, "getlist"):
            return dictionary.getlist(self.field_name)
        return super().get_value(dictionary)

    def to_internal_value(self, data):
        if isinstance(data, (list, tuple)):
            for upload in data:
                validate_exchange_photo_file(upload)
        return super().to_internal_value(data)


class CategorySerializer(serializers.ModelSerializer):
    image = serializers.CharField(allow_blank=True, required=False)

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description", "image"]


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slug = serializers.CharField(source="category.slug", read_only=True)
    condition_label = serializers.CharField(source="get_condition_display", read_only=True)
    image = serializers.CharField(allow_blank=True, required=False)
    image_file = serializers.ImageField(write_only=True, required=False)

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "category", "category_name", "category_slug", "brand",
            "description", "price", "old_price", "image", "image_file", "images", "stock", "condition",
            "condition_label", "warranty", "rating", "ratings_count", "created_at", "is_active",
        ]
        read_only_fields = ["id", "rating", "ratings_count", "created_at"]

    def to_internal_value(self, data):
        if hasattr(data, "get") and isinstance(data.get("images"), str):
            data = data.copy()
            try:
                data["images"] = json.loads(data["images"])
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError({"images": "Enter a valid JSON list of image URLs."}) from exc
        return super().to_internal_value(data)

    def create(self, validated_data):
        image_file = validated_data.pop("image_file", None)
        product = super().create(validated_data)
        if image_file:
            product.image_upload = image_file
            product.save(update_fields=["image_upload"])
        return product

    def update(self, instance, validated_data):
        image_file = validated_data.pop("image_file", None)
        product = super().update(instance, validated_data)
        if image_file:
            product.image_upload = image_file
            product.save(update_fields=["image_upload"])
        return product

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.image_upload:
            data["image"] = instance.image_upload.url
        return data


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.filter(is_active=True), source="product", write_only=True
    )
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = ["id", "product", "product_id", "quantity", "line_total"]

    def get_line_total(self, obj):
        return obj.product.price * obj.quantity


class WishlistSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.filter(is_active=True), source="product", write_only=True
    )

    class Meta:
        model = WishlistItem
        fields = ["id", "product", "product_id", "created_at"]


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ["id", "full_name", "phone", "line1", "line2", "city", "state", "postal_code", "is_default"]


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "image", "price", "quantity"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "status", "payment_method", "payment_status", "subtotal",
            "discount", "total", "coupon_code", "shipping_address", "items", "created_at",
        ]


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)

    class Meta:
        model = Review
        fields = ["id", "user_name", "rating", "comment", "created_at"]
        read_only_fields = ["id", "user_name", "created_at"]


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = ["id", "code", "discount_percent", "active", "expires_at"]


class ExchangeRequestSerializer(serializers.ModelSerializer):
    estimate = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    status = serializers.CharField(read_only=True)
    photos_upload = ExchangePhotoListField(write_only=True, required=False)
    photos = serializers.SerializerMethodField()

    class Meta:
        model = ExchangeRequest
        fields = [
            "id", "product_type", "product_name", "condition", "description", "photo",
            "photos_upload", "photos", "estimate", "status", "created_at",
        ]
        read_only_fields = ["id", "estimate", "status", "created_at"]

    def validate_photo(self, upload):
        if upload:
            validate_exchange_photo_file(upload)
        return upload

    def create(self, validated_data):
        photo_uploads = validated_data.pop("photos_upload", [])
        submission = super().create(validated_data)
        for upload in photo_uploads:
            ExchangeRequestPhoto.objects.create(exchange_request=submission, photo=upload)
        return submission

    def get_photos(self, obj):
        request = self.context.get("request")
        photos = []
        for uploaded in obj.photos.all():
            url = uploaded.photo.url
            photos.append({
                "url": request.build_absolute_uri(url) if request else url,
                "name": uploaded.photo.name.rsplit("/", 1)[-1],
            })
        return photos


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_active", "is_staff", "date_joined"]
        read_only_fields = ["id", "username", "is_active", "is_staff", "date_joined"]


class RegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["name", "email", "subject", "message"]
