from decimal import Decimal

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCustomerOrGuest
from catalog.models import ProductVariant
from commerce.serializers import CartItemWriteSerializer, CartLineSerializer, CartQuantitySerializer
from commerce.services.cart import (
    SESSION_MERGE_WARNINGS_KEY,
    cart_quantities,
    clear_cart,
    priced_lines,
    set_cart_quantity,
)


def cart_response(request: Request) -> Response:
    lines = priced_lines(request)
    return Response({
        "items": CartLineSerializer(lines, many=True).data,
        "subtotal": str(sum((line.line_total for line in lines), 0)),
        "warnings": request.session.pop(SESSION_MERGE_WARNINGS_KEY, []),
    })


class CartView(APIView):
    """``GET /api/cart/`` (revalidated lines with warnings) and ``DELETE /api/cart/``.

    Guests use a session-only cart; customers the database cart. Items are addressed by variant id.
    """

    permission_classes = [IsCustomerOrGuest]

    def get(self, request: Request) -> Response:
        return cart_response(request)

    def delete(self, request: Request) -> Response:
        clear_cart(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CartItemsView(APIView):
    """``POST /api/cart/items/`` — add a quantity of a variant (added to an existing line)."""

    permission_classes = [IsCustomerOrGuest]

    def post(self, request: Request) -> Response:
        serializer = CartItemWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        variant = serializer.validated_data["variant"]
        quantity = cart_quantities(request).get(variant.pk, 0) + serializer.validated_data["quantity"]
        return self.store(request, variant, quantity, status.HTTP_201_CREATED)

    @staticmethod
    def store(request: Request, variant: ProductVariant, quantity: Decimal, response_status: int) -> Response:
        if errors := variant.purchase_errors(quantity):
            return Response({"quantity": errors}, status=status.HTTP_400_BAD_REQUEST)
        set_cart_quantity(request, variant.pk, quantity)
        response = cart_response(request)
        response.status_code = response_status
        return response


class CartItemView(APIView):
    """``PATCH /api/cart/items/{variant_id}/`` (set quantity) and ``DELETE`` (remove the line)."""

    permission_classes = [IsCustomerOrGuest]

    def patch(self, request: Request, variant_id: int) -> Response:
        serializer = CartQuantitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if variant_id not in cart_quantities(request):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        variant = ProductVariant.objects.select_related("product").get(pk=variant_id)
        return CartItemsView.store(request, variant, serializer.validated_data["quantity"], status.HTTP_200_OK)

    def delete(self, request: Request, variant_id: int) -> Response:
        set_cart_quantity(request, variant_id, None)
        return Response(status=status.HTTP_204_NO_CONTENT)
