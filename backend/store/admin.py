from django.contrib import admin
from django.utils.html import format_html

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


class ExchangeRequestPhotoInline(admin.TabularInline):
    model = ExchangeRequestPhoto
    extra = 0
    fields = ("photo", "preview", "uploaded_at")
    readonly_fields = ("preview", "uploaded_at")

    @admin.display(description="Preview")
    def preview(self, obj):
        if not obj.photo:
            return "—"
        return format_html('<a href="{}" target="_blank"><img src="{}" width="120" alt="Exchange photo"></a>', obj.photo.url, obj.photo.url)


@admin.register(ExchangeRequest)
class ExchangeRequestAdmin(admin.ModelAdmin):
    list_display = ("product_name", "product_type", "condition", "estimate", "status", "created_at")
    list_filter = ("product_type", "condition", "status")
    search_fields = ("product_name", "user__email")
    inlines = [ExchangeRequestPhotoInline]


admin.site.register([Category, Product, CartItem, WishlistItem, Address, Coupon, Order, OrderItem, Review, ContactMessage])
