from django.db import transaction
from rest_framework import serializers

from commerce.models import City, ShippingMethod


class ShippingMethodSerializer(serializers.ModelSerializer):
    """With ``applies_to_all_cities`` off, at least one city is required (``ShippingMethod.validate_cities``)."""

    cities = serializers.PrimaryKeyRelatedField(queryset=City.objects.all(), many=True, required=False)

    class Meta:
        model = ShippingMethod
        fields = ["id", "name", "description", "price", "applies_to_all_cities", "is_active", "sort_order", "cities"]

    def validate(self, attrs: dict) -> dict:
        applies_to_all = attrs.get("applies_to_all_cities", getattr(self.instance, "applies_to_all_cities", True))
        if "cities" in attrs:
            cities = attrs["cities"]
        else:
            cities = list(self.instance.cities.all()) if self.instance else []
        ShippingMethod.validate_cities(applies_to_all, [city.pk for city in cities])
        return attrs

    def create(self, validated_data: dict) -> ShippingMethod:
        with transaction.atomic():
            return super().create(validated_data)

    def update(self, instance: ShippingMethod, validated_data: dict) -> ShippingMethod:
        with transaction.atomic():
            return super().update(instance, validated_data)
