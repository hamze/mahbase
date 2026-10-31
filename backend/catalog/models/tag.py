from django.db import models
from django.db.models import Q


class Tag(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    categories = models.ManyToManyField("catalog.Category", blank=True, related_name="tags")

    class Meta:
        ordering = ["name"]
        permissions = [("tags_manage", "Can manage tags")]

    def __str__(self) -> str:
        return self.name

    @classmethod
    def for_category(cls, category_id: int | str) -> models.QuerySet:
        """Tags usable in a category.

        A tag without categories applies to every category, present and future; a tag linked to a main
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
