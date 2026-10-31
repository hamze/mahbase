from django.db.models import Q, QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer

from catalog.models import Product, ProductVariant
from catalog.serializers import ProductSerializer, ProductVariantSerializer, ProductWriteSerializer


class ProductViewSet(viewsets.ModelViewSet):
    """Products: GET detail is looked up by slug, every other detail route by id."""

    lookup_url_kwarg = "lookup"
    lookup_value_regex = "[^/]+"
    rbac_permissions = {
        "create": "products.create",
        "update": "products.edit",
        "partial_update": "products.edit",
        "destroy": "products.delete",
        "restore": "products.delete",
        "toggle_publish": "products.publish",
        "add_variant": "products.edit",
        "update_variant": "products.edit",
    }

    def get_queryset(self) -> QuerySet:
        return Product.objects.select_related("category", "brand", "unit").prefetch_related(
            "tags", "attribute_values__attribute", "variants__attributes__attribute", "media"
        )

    def get_serializer_class(self) -> type[BaseSerializer]:
        return ProductWriteSerializer if self.action in ("create", "update", "partial_update") else ProductSerializer

    def get_object(self) -> Product:
        lookup = self.kwargs["lookup"]
        if self.action == "retrieve":
            return get_object_or_404(self.get_queryset(), slug=lookup)
        if not lookup.isdigit():
            raise NotFound()
        return get_object_or_404(self.get_queryset(), pk=lookup)

    def filter_queryset(self, queryset: QuerySet) -> QuerySet:
        """Filters: category (includes subcategories), brand, tag, is_published, deleted, search."""
        params = self.request.query_params
        deleted = params.get("deleted", "false")
        if deleted == "true":
            queryset = queryset.filter(deleted_at__isnull=False)
        elif deleted != "all":
            queryset = queryset.filter(deleted_at__isnull=True)
        if category := params.get("category"):
            queryset = queryset.filter(Q(category_id=category) | Q(category__parent_id=category))
        if brand := params.get("brand"):
            queryset = queryset.filter(brand_id=brand)
        if tag := params.get("tag"):
            queryset = queryset.filter(tags=tag)
        if is_published := params.get("is_published"):
            queryset = queryset.filter(is_published=is_published == "true")
        if search := params.get("search"):
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(slug__icontains=search) | Q(variants__sku__icontains=search)
            ).distinct()
        return queryset

    def perform_destroy(self, product: Product) -> None:
        product.soft_delete()

    @action(detail=True, methods=["patch"], url_path="toggle-publish")
    def toggle_publish(self, request: Request, lookup: str) -> Response:
        product = self.get_object()
        product.toggle_publish()
        return Response(ProductSerializer(product, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["patch"])
    def restore(self, request: Request, lookup: str) -> Response:
        product = self.get_object()
        product.restore()
        return Response(ProductSerializer(product, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="variants")
    def add_variant(self, request: Request, lookup: str) -> Response:
        product = self.get_object()
        serializer = ProductVariantSerializer(data=request.data, context=self._variant_context(product))
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["put"], url_path=r"variants/(?P<variant_id>\d+)")
    def update_variant(self, request: Request, lookup: str, variant_id: str) -> Response:
        product = self.get_object()
        variant = get_object_or_404(ProductVariant, pk=variant_id, product=product)
        serializer = ProductVariantSerializer(variant, data=request.data, context=self._variant_context(product))
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def _variant_context(self, product: Product) -> dict:
        return {**self.get_serializer_context(), "product": product}
