from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import models


class Attribute(models.Model):
    class Type(models.TextChoices):
        SELECT = "select", "Select"
        TEXT = "text", "Text"
        NUMBER = "number", "Number"

    name = models.CharField(max_length=200)
    type = models.CharField(max_length=10, choices=Type.choices)
    is_filterable = models.BooleanField(default=False)
    is_variant_generator = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    categories = models.ManyToManyField("catalog.Category", blank=True, related_name="attributes")

    class Meta:
        ordering = ["name"]
        permissions = [("attributes_manage", "Can manage attributes")]

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        if self.pk is None:
            return
        stored = Attribute.objects.get(pk=self.pk)
        changed = stored.type != self.type or stored.is_variant_generator != self.is_variant_generator
        if changed and stored.is_referenced():
            raise ValidationError("نوع یا نقش تنوع ویژگی‌ای که در محصولات استفاده شده قابل تغییر نیست.")

    def is_referenced(self) -> bool:
        return self.product_values.exists() or self.variant_values.exists()

    def normalize_value(self, value: str) -> str:
        value = str(value).strip()
        if not value:
            raise ValidationError(f"مقدار ویژگی «{self.name}» الزامی است.")
        if self.type == self.Type.SELECT:
            if not self.options.filter(value=value, is_active=True).exists():
                raise ValidationError(f"'{value}' is not an allowed option for attribute '{self.name}'.")
        elif self.type == self.Type.NUMBER:
            try:
                value = str(Decimal(value).normalize())
            except InvalidOperation:
                raise ValidationError(f"مقدار ویژگی «{self.name}» باید عدد باشد.")
        return value

    @classmethod
    def validate_values(
        cls, category_id: int, pairs: list[tuple["Attribute", str]], *, variant_generator: bool
    ) -> list[tuple["Attribute", str]]:
        """Validate (attribute, value) pairs for a product of ``category_id``.

        Descriptive product values may only use non-generator attributes and variant values only
        generator attributes; every attribute must be assigned to the category.
        """
        seen = set()
        errors = []
        normalized = []
        allowed_ids = set(
            cls.objects.filter(categories=category_id).values_list("id", flat=True)
        )
        for attribute, value in pairs:
            if attribute.pk in seen:
                errors.append(f"ویژگی «{attribute.name}» بیش از یک بار داده شده است.")
                continue
            seen.add(attribute.pk)
            if attribute.pk not in allowed_ids:
                errors.append(f"ویژگی «{attribute.name}» متعلق به دسته‌بندی محصول نیست.")
                continue
            if attribute.is_variant_generator != variant_generator:
                kind = "variant-generating" if variant_generator else "descriptive"
                errors.append(f"ویژگی «{attribute.name}» از نوع {kind} نیست.")
                continue
            try:
                normalized.append((attribute, attribute.normalize_value(value)))
            except ValidationError as e:
                errors.extend(e.messages)
        if errors:
            raise ValidationError(errors)
        return normalized
