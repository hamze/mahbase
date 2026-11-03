from django.contrib import admin

from commerce.models import City, PaymentTransaction, Province


@admin.register(Province)
class ProvinceAdmin(admin.ModelAdmin):
    list_display = ["name", "is_active"]
    search_fields = ["name"]


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ["name", "province", "is_active"]
    list_filter = ["province", "is_active"]
    search_fields = ["name"]


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    """Read-only: payment rows are evidence and are only inserted by the callback."""

    list_display = ["order", "gateway", "gateway_transaction_id", "amount", "status", "created_at"]
    list_filter = ["status", "gateway"]

    def has_add_permission(self, request: object) -> bool:
        return False

    def has_change_permission(self, request: object, obj: object = None) -> bool:
        return False
