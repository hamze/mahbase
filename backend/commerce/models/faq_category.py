from django.db import models


class FAQCategory(models.Model):
    title = models.CharField(max_length=200)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name_plural = "FAQ categories"

    def __str__(self) -> str:
        return self.title
