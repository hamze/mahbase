from django.contrib.auth.models import User
from rest_framework import serializers

from accounts.models import UserProfile
from accounts.serializers import AdminUserSerializer
from catalog.models.product_variant import QUANTITY
from commerce.serializers.address import AddressSerializer


class AdminOrderLineSerializer(serializers.Serializer):
    variant = serializers.IntegerField()
    quantity = serializers.DecimalField(**QUANTITY)


class AdminOrderCreateSerializer(serializers.Serializer):
    """``POST /api/admin/orders/``: exactly one of ``customer``/``new_customer`` and of ``address``/``new_address``.

    Purchase rules, prices, the address owner and the shipping city are checked by ``place_order``, as for customers.
    """

    customer = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(profile__isnull=False, is_active=True), required=False, allow_null=True
    )
    new_customer = AdminUserSerializer(required=False, allow_null=True)
    address = serializers.IntegerField(required=False, allow_null=True)
    new_address = AddressSerializer(required=False, allow_null=True)
    shipping_method = serializers.IntegerField()
    discount_code = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    items = AdminOrderLineSerializer(many=True, allow_empty=False)

    def validate(self, attrs: dict) -> dict:
        customer, new_customer = attrs.get("customer"), attrs.get("new_customer")
        if (customer is None) == (new_customer is None):
            raise serializers.ValidationError({"customer": "Select a customer or enter a new one."})
        if (attrs.get("address") is None) == (attrs.get("new_address") is None):
            raise serializers.ValidationError({"address": "Select an address or enter a new one."})
        if new_customer is not None and attrs.get("address") is not None:
            raise serializers.ValidationError({"address": "A new customer needs a new address."})
        variant_ids = [line["variant"] for line in attrs["items"]]
        if len(variant_ids) != len(set(variant_ids)):
            raise serializers.ValidationError({"items": "Each variant may appear only once."})
        if new_customer is not None:
            attrs["new_customer"] = {
                "mobile": new_customer["username"],
                "first_name": new_customer.get("first_name", ""),
                "last_name": new_customer.get("last_name", ""),
                "customer_tier": new_customer.get("profile", {}).get(
                    "customer_tier", UserProfile.CustomerTier.RETAIL
                ),
            }
        return attrs
