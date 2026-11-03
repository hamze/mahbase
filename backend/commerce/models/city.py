from django.db import models


class City(models.Model):
    province = models.ForeignKey("commerce.Province", on_delete=models.PROTECT, related_name="cities")
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "cities"
        constraints = [models.UniqueConstraint(fields=["province", "name"], name="uniq_city_per_province")]

    def __str__(self) -> str:
        return self.name
