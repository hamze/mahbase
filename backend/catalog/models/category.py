from django.core.exceptions import ValidationError
from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="children"
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    seo_title = models.CharField(max_length=255, blank=True)
    seo_description = models.TextField(blank=True)

    class Meta:
        ordering = ["sort_order", "id"]
        permissions = [("categories_manage", "Can manage categories")]

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        if self.parent_id is None:
            return
        if self.parent_id == self.pk:
            raise ValidationError({"parent": "A category cannot be its own parent."})
        if self.parent.parent_id is not None:
            raise ValidationError({"parent": "Categories are limited to two levels."})
        if self.pk and self.children.exists():
            raise ValidationError({"parent": "A category with subcategories cannot become a subcategory."})

    def is_referenced(self) -> bool:
        return self.children.exists() or self.products.exists()
