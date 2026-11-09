from typing import TYPE_CHECKING

import bleach
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

if TYPE_CHECKING:
    from catalog.models import Attribute, Brand, Category, Tag

ALLOWED_DESCRIPTION_TAGS = [
    "p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "h4",
    "ul", "ol", "li", "blockquote", "a", "img", "table", "thead", "tbody", "tr", "th", "td",
]
ALLOWED_DESCRIPTION_ATTRIBUTES = {
    "a": ["href", "title", "rel", "target"],
    "img": ["src", "alt", "width", "height"],
}
ALLOWED_DESCRIPTION_PROTOCOLS = ["http", "https", "mailto"]


def sanitize_html(value: str) -> str:
    """The one rich-text allowlist: product descriptions, FAQ and question answers, blog content, store footer."""
    return bleach.clean(
        value,
        tags=ALLOWED_DESCRIPTION_TAGS,
        attributes=ALLOWED_DESCRIPTION_ATTRIBUTES,
        protocols=ALLOWED_DESCRIPTION_PROTOCOLS,
        strip=True,
    )


class Product(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    category = models.ForeignKey("catalog.Category", on_delete=models.PROTECT, related_name="products")
    brand = models.ForeignKey(
        "catalog.Brand", null=True, blank=True, on_delete=models.PROTECT, related_name="products"
    )
    unit = models.ForeignKey("catalog.Unit", on_delete=models.PROTECT, related_name="products")
    description_short = models.TextField(blank=True)
    description_long = models.TextField(blank=True)
    is_published = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    tags = models.ManyToManyField("catalog.Tag", blank=True, related_name="products")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]
        permissions = [
            ("products_create", "Can create products"),
            ("products_edit", "Can edit products"),
            ("products_publish", "Can publish products"),
            ("products_delete", "Can soft-delete and restore products"),
            ("products_edit_price", "Can edit variant prices"),
            ("products_edit_stock", "Can edit variant stock"),
        ]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs) -> None:
        self.description_long = sanitize_html(self.description_long)
        super().save(*args, **kwargs)

    @staticmethod
    def validate_catalog_assignments(category: "Category", brand: "Brand | None", tags: list["Tag"]) -> None:
        """Brand and tags must be usable in the product category (see ``Brand/Tag.for_category``)."""
        from catalog.models import Brand, Tag

        errors = {}
        if brand is not None and not Brand.for_category(category.pk).filter(pk=brand.pk).exists():
            errors["brand"] = f"Brand '{brand.name}' does not belong to category '{category.name}'."
        tag_ids = {tag.pk for tag in tags}
        allowed = set(Tag.for_category(category.pk).filter(pk__in=tag_ids).values_list("pk", flat=True))
        invalid = [tag.name for tag in tags if tag.pk not in allowed]
        if invalid:
            errors["tags"] = f"Tags {invalid} do not belong to category '{category.name}'."
        if errors:
            raise ValidationError(errors)

    def validate_category_change(self, category: "Category", *, keep_attribute_values: bool) -> None:
        """Values that stay assigned must remain valid for the new category.

        Variant attribute values always stay; descriptive values stay unless the update replaces them.
        """
        from catalog.models import Attribute

        if keep_attribute_values:
            Attribute.validate_values(
                category.pk,
                [(value.attribute, value.value) for value in self.attribute_values.select_related("attribute")],
                variant_generator=False,
            )
        for variant in self.variants.all():
            Attribute.validate_values(
                category.pk,
                [(value.attribute, value.value) for value in variant.attributes.select_related("attribute")],
                variant_generator=True,
            )

    def set_attribute_values(self, pairs: list[tuple["Attribute", str]]) -> None:
        """Replace descriptive attribute values with already validated pairs."""
        from catalog.models import ProductAttributeValue

        self.attribute_values.all().delete()
        ProductAttributeValue.objects.bulk_create(
            ProductAttributeValue(product=self, attribute=attribute, value=value) for attribute, value in pairs
        )

    def toggle_publish(self) -> None:
        self.is_published = not self.is_published
        self.save(update_fields=["is_published", "updated_at"])

    def soft_delete(self) -> None:
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])

    def restore(self) -> None:
        self.deleted_at = None
        self.save(update_fields=["deleted_at", "updated_at"])
