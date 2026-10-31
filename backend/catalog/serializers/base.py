from copy import copy

from rest_framework import serializers


class ModelCleanSerializer(serializers.ModelSerializer):
    """Runs the model's ``clean()`` on the proposed state so domain rules stay on the model."""

    def validate(self, attrs: dict) -> dict:
        attrs = super().validate(attrs)
        model = self.Meta.model
        concrete = {field.name for field in model._meta.concrete_fields}
        candidate = copy(self.instance) if self.instance is not None else model()
        for name, value in attrs.items():
            if name in concrete:
                setattr(candidate, name, value)
        candidate.clean()
        return attrs
