import secrets
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCustomer
from commerce.models import DiscountCode, ShippingMethod
from commerce.serializers import DiscountCodeGenerateSerializer, DiscountCodeSerializer, DiscountValidateSerializer
from commerce.services.cart import priced_lines
from commerce.views.base import AdminPermissionMixin


class AdminDiscountCodeViewSet(AdminPermissionMixin, viewsets.ModelViewSet):
    """``/api/admin/discount-codes/``; DELETE deactivates a code already used by orders. ``generate`` bulk-creates
    ``count`` single-use codes (``code`` is the prefix).
    """

    serializer_class = DiscountCodeSerializer
    manage_permission = "admin.discounts.manage"

    def get_queryset(self) -> QuerySet:
        codes = DiscountCode.objects.all()
        if search := self.request.query_params.get("search"):
            codes = codes.filter(code__icontains=search)
        return codes

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        code = self.get_object()
        if code.orders.exists():
            code.is_active = False
            code.save(update_fields=["is_active"])
            return Response({"id": code.pk, "deactivated": True})
        code.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"])
    def generate(self, request: Request) -> Response:
        serializer = DiscountCodeGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        count = data.pop("count")
        prefix = data.pop("code", "").upper()
        data.update(usage_limit_total=1, per_user_limit=1)
        with transaction.atomic():
            codes = DiscountCode.objects.bulk_create(
                DiscountCode(code=f"{prefix}{secrets.token_hex(4).upper()}", **data) for _ in range(count)
            )
        return Response(DiscountCodeSerializer(codes, many=True).data, status=status.HTTP_201_CREATED)


class DiscountValidateView(APIView):
    """``POST /api/discounts/validate/`` — what a code would give on the current cart; never changes state."""

    permission_classes = [IsCustomer]

    def post(self, request: Request) -> Response:
        serializer = DiscountValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = DiscountCode.objects.filter(code__iexact=serializer.validated_data["code"]).first()
        if code is None:
            raise ValidationError({"code": "کد تخفیف نامعتبر است."})
        shipping_cost = Decimal("0")
        if shipping_id := serializer.validated_data.get("shipping_method"):
            shipping_cost = get_object_or_404(ShippingMethod, pk=shipping_id, is_active=True).price
        lines = priced_lines(request)
        discount, shipping_discount = code.evaluate(
            request.user, [(line.product, line.line_total) for line in lines], shipping_cost
        )
        return Response({"code": code.code, "discount_amount": discount, "shipping_discount_amount": shipping_discount})
