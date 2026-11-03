from django.db import transaction
from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from commerce.models import AuditLog, ReturnRequest
from commerce.serializers import ReturnRequestSerializer
from commerce.services.refunds import process_refund
from commerce.views.base import AdminPermissionMixin


class ReceiveSerializer(serializers.Serializer):
    resaleable = serializers.DictField(child=serializers.BooleanField())


class CompleteSerializer(serializers.Serializer):
    refund_amount = serializers.DecimalField(max_digits=18, decimal_places=2, required=False, allow_null=True)


class AdminReturnViewSet(AdminPermissionMixin, viewsets.ReadOnlyModelViewSet):
    """``/api/admin/returns/`` — approve → receive (``resaleable`` per item) → complete (creates and processes the
    ``OrderRefund(RETURN)``; stock and returned quantities update when that refund completes).
    """

    serializer_class = ReturnRequestSerializer
    manage_permission = "admin.orders.view_all"
    rbac_action_permissions = {
        "approve": "admin.returns.approve",
        "reject": "admin.returns.approve",
        "receive": "admin.returns.receive",
        "complete": "admin.returns.complete",
    }

    def get_queryset(self) -> QuerySet:
        returns = ReturnRequest.objects.select_related("order", "order_refund").prefetch_related("items__order_item")
        if return_status := self.request.query_params.get("status"):
            returns = returns.filter(status=return_status)
        return returns

    def _return_request(self, pk: str) -> ReturnRequest:
        # The transition methods lock the order, then the request, and validate the status under that lock.
        return get_object_or_404(ReturnRequest, pk=pk)

    def _respond(self, return_request: ReturnRequest) -> Response:
        return Response(self.get_serializer(self.get_queryset().get(pk=return_request.pk)).data)

    @action(detail=True, methods=["post"])
    def approve(self, request: Request, pk: str) -> Response:
        with transaction.atomic():
            return_request = self._return_request(pk)
            return_request.approve()
            AuditLog.record(request.user, "return.approve", return_request)
        return self._respond(return_request)

    @action(detail=True, methods=["post"])
    def reject(self, request: Request, pk: str) -> Response:
        with transaction.atomic():
            return_request = self._return_request(pk)
            return_request.reject()
            AuditLog.record(request.user, "return.reject", return_request)
        return self._respond(return_request)

    @action(detail=True, methods=["post"])
    def receive(self, request: Request, pk: str) -> Response:
        serializer = ReceiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resaleable = {int(item_id): value for item_id, value in serializer.validated_data["resaleable"].items()}
        with transaction.atomic():
            return_request = self._return_request(pk)
            return_request.receive(resaleable)
            AuditLog.record(request.user, "return.receive", return_request, resaleable=resaleable)
        return self._respond(return_request)

    @action(detail=True, methods=["post"])
    def complete(self, request: Request, pk: str) -> Response:
        serializer = CompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            return_request = self._return_request(pk)
            refund = return_request.start_refund(request.user, serializer.validated_data.get("refund_amount"))
            AuditLog.record(request.user, "return.complete", return_request, refund=refund.pk, amount=refund.amount)
        process_refund(refund.pk)
        return self._respond(return_request)
