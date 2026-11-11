from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

INTERNAL_PAGES_SLUG = "internal-pages"


class BlogCategory(models.Model):
    """Blog category (separate from catalog categories), at most two levels.

    The single internal category (seeded, slug ``internal-pages``) holds site pages such as About Us; it and its
    posts never appear in the public blog.
    """

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    description_short = models.TextField(null=True, blank=True)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT, related_name="children")
    is_active = models.BooleanField(default=True)
    is_internal = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)
    seo_title = models.CharField(max_length=255, null=True, blank=True)
    seo_description = models.TextField(null=True, blank=True)
    canonical_url = models.URLField(max_length=500, null=True, blank=True)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["is_internal"], condition=Q(is_internal=True), name="blog_single_internal_category"
            ),
        ]

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        if self.parent_id is None:
            return
        if self.parent_id == self.pk:
            raise ValidationError({"parent": "دسته‌بندی نمی‌تواند والد خودش باشد."})
        if self.parent.parent_id is not None:
            raise ValidationError({"parent": "دسته‌بندی‌های وبلاگ حداکثر دو سطح دارند."})
        if self.pk and self.children.exists():
            raise ValidationError({"parent": "دسته‌بندی دارای زیردسته نمی‌تواند زیردسته شود."})

    def delete(self, *args, **kwargs) -> tuple[int, dict[str, int]]:
        if self.posts.exists() or self.children.exists():
            raise ValidationError("دسته‌بندی وبلاگ دارای نوشته یا زیردسته قابل حذف نیست.")
        return super().delete(*args, **kwargs)
