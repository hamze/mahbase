from django.db import models
from django.db.models import Q


class Brand(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    logo = models.ForeignKey(
        "catalog.MediaAsset", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    is_active = models.BooleanField(default=True)
    categories = models.ManyToManyField("catalog.Category", blank=True, related_name="brands")

    class Meta:
        ordering = ["name"]
        permissions = [("brands_manage", "Can manage brands")]

    def __str__(self) -> str:
        return self.name

    @classmethod
    def for_category(cls, category_id: int | str) -> models.QuerySet:
        """Brands usable in a category.

        A brand without categories applies to every category, present and future; a brand linked to a main
        category also applies to all its subcategories.
        """
        from catalog.models import Category

        parent_id = Category.objects.filter(pk=category_id).values("parent_id")
        matching = cls.objects.filter(
            Q(categories__isnull=True) | Q(categories=category_id) | Q(categories__in=parent_id)
        )
        return cls.objects.filter(pk__in=matching.values("pk"))

    def is_referenced(self) -> bool:
        return self.products.exists()
