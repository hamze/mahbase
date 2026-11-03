from rest_framework import serializers

from accounts.models import normalize_mobile
from catalog.serializers.base import ModelCleanSerializer
from commerce.models import Address, City, Province


class AddressSerializer(ModelCleanSerializer):
    """Own address (``addresses.manage_self``); the city must belong to the province (``Address.clean``)."""

    province = serializers.PrimaryKeyRelatedField(queryset=Province.objects.filter(is_active=True))
    city = serializers.PrimaryKeyRelatedField(queryset=City.objects.filter(is_active=True))
    province_name = serializers.CharField(source="province.name", read_only=True)
    city_name = serializers.CharField(source="city.name", read_only=True)

    class Meta:
        model = Address
        fields = [
            "id", "title", "receiver_name", "receiver_mobile", "province", "province_name", "city", "city_name",
            "address_line", "postal_code", "plaque", "unit", "latitude", "longitude", "is_default",
        ]
        read_only_fields = ["is_default"]

    def validate_receiver_mobile(self, value: str) -> str:
        return normalize_mobile(value)
