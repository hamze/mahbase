from catalog.models import Unit
from catalog.serializers.base import ModelCleanSerializer


class UnitSerializer(ModelCleanSerializer):
    class Meta:
        model = Unit
        fields = ["id", "name", "symbol", "is_active"]
