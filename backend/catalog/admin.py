from django import forms
from django.contrib import admin
from django.db.models import QuerySet
from django.http import HttpRequest

from catalog.models import (
    Attribute,
    AttributeOption,
    Brand,
    Category,
    MediaAsset,
    Product,
    ProductAttributeValue,
    ProductVariant,
    Tag,
    Unit,
    VariantAttribute,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "parent", "is_active", "sort_order"]
    list_filter = ["is_active", "parent"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ["name"]}


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "is_featured", "is_active"]
    list_filter = ["is_featured", "is_active"]
    search_fields = ["name", "slug"]
    filter_horizontal = ["categories"]


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name", "slug"]
    filter_horizontal = ["categories"]
    raw_id_fields = ["logo"]


class AttributeOptionInline(admin.TabularInline):
    model = AttributeOption
    extra = 0


@admin.register(Attribute)
class AttributeAdmin(admin.ModelAdmin):
    list_display = ["name", "type", "is_filterable", "is_variant_generator", "is_active"]
    list_filter = ["type", "is_variant_generator", "is_active"]
    search_fields = ["name"]
    filter_horizontal = ["categories"]
    inlines = [AttributeOptionInline]


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ["name", "symbol", "is_active"]
    list_filter = ["is_active"]


class ProductAttributeValueForm(forms.ModelForm):
    class Meta:
        model = ProductAttributeValue
        fields = ["attribute", "value"]

    def clean(self) -> dict:
        cleaned = super().clean()
        attribute = cleaned.get("attribute")
        if attribute:
            # The inline formset sets the parent product (with its new category) on the instance.
            [(_, cleaned["value"])] = Attribute.validate_values(
                self.instance.product.category_id, [(attribute, cleaned.get("value", ""))], variant_generator=False
            )
        return cleaned


class ProductAttributeValueInline(admin.TabularInline):
    model = ProductAttributeValue
    form = ProductAttributeValueForm
    extra = 0


class ProductVariantInline(admin.TabularInline):
    """Read-only here: variant attributes and combination_hash change only through the API workflow."""

    model = ProductVariant
    extra = 0
    fields = ["sku", "combination_hash", "stock_quantity", "base_price", "wholesale_price", "discount_percentage",
              "is_discount_active"]
    readonly_fields = fields
    can_delete = False
    show_change_link = True

    def has_add_permission(self, request: HttpRequest, obj: Product | None = None) -> bool:
        return False


class ProductAdminForm(forms.ModelForm):
    class Meta:
        model = Product
        exclude = ["deleted_at"]

    def clean(self) -> dict:
        cleaned = super().clean()
        category = cleaned.get("category")
        if category is None:
            return cleaned
        Product.validate_catalog_assignments(category, cleaned.get("brand"), list(cleaned.get("tags") or []))
        if self.instance.pk and self.instance.category_id != category.pk:
            self.instance.validate_category_change(category, keep_attribute_values=True)
        return cleaned


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    form = ProductAdminForm
    list_display = ["name", "slug", "category", "brand", "is_published", "deleted_at"]
    list_filter = ["is_published", "category", "brand", ("deleted_at", admin.EmptyFieldListFilter)]
    search_fields = ["name", "slug", "variants__sku"]
    filter_horizontal = ["tags"]
    readonly_fields = ["deleted_at", "created_at", "updated_at"]
    inlines = [ProductAttributeValueInline, ProductVariantInline]
    actions = ["soft_delete", "restore"]

    def has_delete_permission(self, request: HttpRequest, obj: Product | None = None) -> bool:
        return False

    @admin.action(description="Soft delete selected products")
    def soft_delete(self, request: HttpRequest, queryset: QuerySet) -> None:
        for product in queryset:
            product.soft_delete()

    @admin.action(description="Restore selected products")
    def restore(self, request: HttpRequest, queryset: QuerySet) -> None:
        for product in queryset:
            product.restore()


class VariantAttributeInline(admin.TabularInline):
    model = VariantAttribute
    extra = 0
    readonly_fields = ["attribute", "value"]
    can_delete = False

    def has_add_permission(self, request: HttpRequest, obj: ProductVariant | None = None) -> bool:
        return False


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ["sku", "product", "stock_quantity", "base_price", "is_discount_active"]
    search_fields = ["sku", "product__name"]
    readonly_fields = ["product", "combination_hash", "stock_quantity"]
    inlines = [VariantAttributeInline]

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: ProductVariant | None = None) -> bool:
        return False


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ["id", "file", "image_type", "product", "brand", "category", "temporary_since"]
    list_filter = ["image_type"]
    readonly_fields = ["file", "width", "height", "image_type", "product", "brand", "category", "temporary_since",
                       "created_at"]

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: MediaAsset | None = None) -> bool:
        return False
