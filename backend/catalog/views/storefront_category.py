from django.db.models import Prefetch, Q, QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Attribute, Brand, Category, Product, ProductAttributeValue, VariantAttribute
from catalog.serializers.storefront_category import StorefrontCategorySerializer


class StorefrontCategoryListView(generics.ListAPIView):
    """``GET /api/shop/categories/`` — active main categories, each with its active subcategories (public)."""

    permission_classes = [AllowAny]
    serializer_class = StorefrontCategorySerializer
    pagination_class = None

    def get_queryset(self) -> QuerySet:
        return Category.objects.filter(is_active=True, parent__isnull=True).prefetch_related(
            "media", Prefetch("children", queryset=Category.objects.prefetch_related("media"))
        )


class StorefrontCategoryFiltersView(APIView):
    """``GET /api/shop/categories/{slug}/filters/`` — filter options for a category page (public): brands used by
    its visible products and every filterable attribute with the values those products have.
    """

    permission_classes = [AllowAny]

    def get(self, request: Request, slug: str) -> Response:
        category = get_object_or_404(Category, slug=slug, is_active=True)
        products = Product.storefront().filter(Q(category=category) | Q(category__parent=category)).values("pk")
        brands = Brand.objects.filter(is_active=True, products__in=products).distinct().values("id", "name", "slug")
        values: dict[int, set[str]] = {}
        for model, owner in ((ProductAttributeValue, "product__in"), (VariantAttribute, "variant__product__in")):
            rows = model.objects.filter(**{owner: products}, attribute__is_filterable=True, attribute__is_active=True)
            for attribute_id, value in rows.values_list("attribute_id", "value").distinct():
                values.setdefault(attribute_id, set()).add(value)
        attributes = [
            {"id": attribute.pk, "name": attribute.name, "values": sorted(values[attribute.pk])}
            for attribute in Attribute.objects.filter(pk__in=values)
        ]
        return Response({"brands": list(brands), "attributes": attributes})
