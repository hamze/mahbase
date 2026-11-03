from django.db import transaction
from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from commerce.models import AuditLog, OrderRefund
from commerce.serializers import OrderRefundSerializer
from commerce.services.refunds import process_refund
from commerce.views.base import AdminPermissionMixin


class AdminRefundViewSet(AdminPermissionMixin, viewsets.ReadOnlyModelViewSet):
    """``/api/admin/refunds/`` — approve/reject requested refunds; ``process`` sends an approved one to the gateway."""

    serializer_class = OrderRefundSerializer
    manage_permission = "admin.orders.view_all"
    rbac_action_permissions = {
        "approve": "admin.refunds.approve",
        "reject": "admin.refunds.approve",
        "process": "admin.refunds.complete",
    }

    def get_queryset(self) -> QuerySet:
        refunds = OrderRefund.objects.select_related("order")
        if refund_status := self.request.query_params.get("status"):
            refunds = refunds.filter(status=refund_status)
        return refunds

    def _decide(self, request: Request, pk: str, decision: str) -> Response:
        with transaction.atomic():
            refund = get_object_or_404(OrderRefund.objects.select_for_update(), pk=pk)
            refund.approve(request.user) if decision == "approve" else refund.reject()
            AuditLog.record(request.user, f"refund.{decision}", refund, order=refund.order.order_number)
        return Response(self.get_serializer(refund).data)

    @action(detail=True, methods=["post"])
    def approve(self, request: Request, pk: str) -> Response:
        return self._decide(request, pk, "approve")

    @action(detail=True, methods=["post"])
    def reject(self, request: Request, pk: str) -> Response:
        return self._decide(request, pk, "reject")

    @action(detail=True, methods=["post"])
    def process(self, request: Request, pk: str) -> Response:
        refund = process_refund(get_object_or_404(OrderRefund, pk=pk).pk)
        AuditLog.record(request.user, "refund.process", refund, result=refund.status)
        return Response(self.get_serializer(refund).data)
