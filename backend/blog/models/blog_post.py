from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from catalog.models.product import sanitize_html


class BlogPost(models.Model):
    """Blog article, or an internal site page when its category is the internal one.

    ``is_internal_page`` mirrors ``category.is_internal`` on every save (denormalized for listing queries).
    """

    class Status(models.TextChoices):
        DRAFT = "DRAFT"
        PUBLISHED = "PUBLISHED"

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    category = models.ForeignKey("blog.BlogCategory", on_delete=models.PROTECT, related_name="posts")
    excerpt = models.TextField(null=True, blank=True)
    content = models.TextField(blank=True)
    cover_image = models.ForeignKey(
        "catalog.MediaAsset", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="blog_posts")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    is_internal_page = models.BooleanField(default=False)
    seo_title = models.CharField(max_length=255, null=True, blank=True)
    seo_description = models.TextField(null=True, blank=True)
    canonical_url = models.URLField(max_length=500, null=True, blank=True)
    tags = models.ManyToManyField("catalog.Tag", blank=True, related_name="blog_posts")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.CheckConstraint(
                name="blog_post_published_has_date", condition=~Q(status="PUBLISHED") | Q(published_at__isnull=False)
            ),
        ]
        indexes = [models.Index(fields=["status", "is_internal_page", "-published_at"], name="blog_post_listing_idx")]

    def __str__(self) -> str:
        return self.title

    def save(self, *args, **kwargs) -> None:
        self.content = sanitize_html(self.content)
        self.is_internal_page = self.category.is_internal
        if kwargs.get("update_fields") is not None:
            kwargs["update_fields"] = {*kwargs["update_fields"], "content", "is_internal_page"}
        super().save(*args, **kwargs)

    @classmethod
    def public(cls) -> models.QuerySet:
        """The public blog: published, not deleted, not internal pages, in an active category."""
        return cls.objects.filter(
            status=cls.Status.PUBLISHED, is_internal_page=False, deleted_at__isnull=True, category__is_active=True
        )

    @classmethod
    def internal_pages(cls) -> models.QuerySet:
        return cls.objects.filter(
            status=cls.Status.PUBLISHED,
            is_internal_page=True,
            deleted_at__isnull=True,
            category__is_internal=True,
            category__is_active=True,
        )

    def set_status(self, status: str) -> None:
        """Publishing stamps ``published_at``; moving back to draft clears it."""
        self.status = status
        self.published_at = timezone.now() if status == self.Status.PUBLISHED else None
        self.save(update_fields=["status", "published_at", "updated_at"])

    def soft_delete(self) -> None:
        """Internal pages linked from the site menu (``SITE_MENU_INTERNAL_PAGES``) cannot be deleted."""
        if self.is_internal_page and self.slug in settings.SITE_MENU_INTERNAL_PAGES:
            raise ValidationError("This internal page is linked from the site menu and cannot be deleted.")
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])
