from django.urls import path
from rest_framework.routers import SimpleRouter

from commerce import views

router = SimpleRouter()
router.register("me/addresses", views.AddressViewSet, basename="address")
router.register("me/orders", views.MyOrderViewSet, basename="my-order")
router.register("admin/orders", views.AdminOrderViewSet, basename="admin-order")
router.register("admin/refunds", views.AdminRefundViewSet, basename="admin-refund")
router.register("admin/returns", views.AdminReturnViewSet, basename="admin-return")
router.register("admin/discount-codes", views.AdminDiscountCodeViewSet, basename="admin-discount-code")
router.register("admin/provinces", views.AdminProvinceViewSet, basename="admin-province")
router.register("admin/cities", views.AdminCityViewSet, basename="admin-city")
router.register("admin/shipping-methods", views.AdminShippingMethodViewSet, basename="admin-shipping-method")
router.register("admin/faq-categories", views.AdminFAQCategoryViewSet, basename="admin-faq-category")
router.register("admin/faqs", views.AdminFAQViewSet, basename="admin-faq")
router.register("admin/product-questions", views.AdminProductQuestionViewSet, basename="admin-product-question")
router.register("admin/audit-log", views.AdminAuditLogViewSet, basename="admin-audit-log")
router.register("admin/banners", views.AdminBannerViewSet, basename="admin-banner")
router.register("me/notifications", views.MyNotificationViewSet, basename="my-notification")
router.register("notifications", views.AdminNotificationViewSet, basename="admin-notification")
router.register("reviews", views.AdminProductReviewViewSet, basename="admin-review")
router.register("contact-messages", views.ContactMessageViewSet, basename="contact-message")

urlpatterns = [
    path("geo/provinces/", views.ProvinceListView.as_view(), name="geo-provinces"),
    path("geo/cities/", views.CityListView.as_view(), name="geo-cities"),
    path("cart/", views.CartView.as_view(), name="cart"),
    path("cart/items/", views.CartItemsView.as_view(), name="cart-items"),
    path("cart/items/<int:variant_id>/", views.CartItemView.as_view(), name="cart-item"),
    path("orders/", views.OrderCreateView.as_view(), name="order-create"),
    path("payments/callback/", views.PaymentCallbackView.as_view(), name="payment-callback"),
    path("discounts/validate/", views.DiscountValidateView.as_view(), name="discount-validate"),
    path("shipping-methods/", views.ShippingMethodListView.as_view(), name="shipping-methods"),
    path("faq-categories/", views.FAQCategoryListView.as_view(), name="faq-categories"),
    path("faqs/", views.FAQListView.as_view(), name="faqs"),
    path("products/<int:product_id>/questions/", views.ProductQuestionListView.as_view(), name="product-questions"),
    path("products/<slug:slug>/reviews/", views.ProductReviewListView.as_view(), name="product-reviews"),
    path("banners/", views.BannerListView.as_view(), name="banners"),
    path("settings/", views.StoreSettingsViewSet.as_view({"get": "retrieve", "put": "update"}), name="settings"),
    path("admin/settings/", views.AdminStoreSettingsViewSet.as_view({"get": "retrieve"}), name="admin-settings"),
    *router.urls,
]
