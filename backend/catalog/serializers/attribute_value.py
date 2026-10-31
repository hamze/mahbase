from rest_framework import serializers

from catalog.models import Attribute


class AttributeValueSerializer(serializers.Serializer):
    """An (attribute, value) pair used for descriptive product values and variant attributes."""

    attribute = serializers.PrimaryKeyRelatedField(queryset=Attribute.objects.all())
    attribute_name = serializers.CharField(source="attribute.name", read_only=True)
    value = serializers.CharField(max_length=255)


def as_pairs(values: list[dict]) -> list[tuple[Attribute, str]]:
    return [(item["attribute"], item["value"]) for item in values]
