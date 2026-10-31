from catalog.models import Attribute
from catalog.serializers.attribute_option import AttributeOptionSerializer
from catalog.serializers.base import ModelCleanSerializer


class AttributeSerializer(ModelCleanSerializer):
    options = AttributeOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Attribute
        fields = ["id", "name", "type", "is_filterable", "is_variant_generator", "is_active", "categories", "options"]
