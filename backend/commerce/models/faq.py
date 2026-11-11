from django.conf import settings
from django.db import models

from catalog.models.product import sanitize_html


class FAQ(models.Model):
    category = models.ForeignKey("commerce.FAQCategory", on_delete=models.PROTECT, related_name="faqs")
    question = models.CharField(max_length=500)
    answer = models.TextField()
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    # Shown in the home page FAQ block, ordered by ``home_sort_order``.
    show_on_home = models.BooleanField(default=False)
    home_sort_order = models.IntegerField(default=0)
    created_by_admin = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "FAQ"
        permissions = [("admin_faqs_manage", "Can manage FAQs")]

    def __str__(self) -> str:
        return self.question

    def save(self, *args, **kwargs) -> None:
        self.answer = sanitize_html(self.answer)
        super().save(*args, **kwargs)
