from catalog.models import AttributeOption
from catalog.serializers.base import ModelCleanSerializer


class AttributeOptionSerializer(ModelCleanSerializer):
    class Meta:
        model = AttributeOption
        fields = ["id", "attribute", "value", "sort_order", "is_active"]
        read_only_fields = ["attribute"]
