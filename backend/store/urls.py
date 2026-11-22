from django.urls import include, path, re_path
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token

from .views import (
    AddressViewSet,
    AdminCategoryViewSet,
    AdminCouponViewSet,
    AdminOrderViewSet,
    AdminProductViewSet,
    AdminUserViewSet,
    CartView,
    CategoryListView,
    ContactMessageView,
    CouponCheckView,
    ExchangeEstimateView,
    FeaturedReviewsView,
    LoginView,
    LogoutView,
    OrderDetailView,
    OrderListCreateView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    ProductDetailView,
    ProductListView,
    ProfileView,
    RazorpayCreateOrderView,
    RazorpayVerifyView,
    RegisterView,
    ReviewListCreateView,
    WishlistView,
    api_root,
    admin_stats,
)

router = DefaultRouter()
router.register("addresses", AddressViewSet, basename="address")
router.register("admin/products", AdminProductViewSet, basename="admin-product")
router.register("admin/categories", AdminCategoryViewSet, basename="admin-category")
router.register("admin/orders", AdminOrderViewSet, basename="admin-order")
router.register("admin/coupons", AdminCouponViewSet, basename="admin-coupon")
router.register("admin/users", AdminUserViewSet, basename="admin-user")

urlpatterns = [
    re_path(r"^$", api_root, name="store-api-root"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/token/", obtain_auth_token, name="token"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/forgot-password/", PasswordResetRequestView.as_view(), name="forgot-password"),
    path("auth/reset-password/", PasswordResetConfirmView.as_view(), name="reset-password"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("categories/", CategoryListView.as_view(), name="categories"),
    path("products/", ProductListView.as_view(), name="products"),
    path("products/<slug:slug>/", ProductDetailView.as_view(), name="product-detail"),
    path("products/<int:product_id>/reviews/", ReviewListCreateView.as_view(), name="reviews"),
    path("reviews/featured/", FeaturedReviewsView.as_view(), name="featured-reviews"),
    path("cart/", CartView.as_view(), name="cart"),
    path("wishlist/", WishlistView.as_view(), name="wishlist"),
    path("coupons/check/", CouponCheckView.as_view(), name="coupon-check"),
    path("orders/", OrderListCreateView.as_view(), name="orders"),
    path("orders/<str:order_number>/", OrderDetailView.as_view(), name="order-detail"),
    path("payments/razorpay/create/", RazorpayCreateOrderView.as_view(), name="razorpay-create"),
    path("payments/razorpay/verify/", RazorpayVerifyView.as_view(), name="razorpay-verify"),
    path("exchange/estimate/", ExchangeEstimateView.as_view(), name="exchange-estimate"),
    path("contact/", ContactMessageView.as_view(), name="contact"),
    path("admin/stats/", admin_stats, name="admin-stats"),
    path("", include(router.urls)),
]
