from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from commerce.models import Order
from commerce.serializers import PaymentCallbackSerializer
from commerce.services.payment_gateway.provider import get_payment_gateway
from commerce.services.payments import DuplicateGatewayTransaction, handle_callback


class PaymentCallbackView(APIView):
    """``POST /api/payments/callback/`` — gateway result. 200 for every applied, idempotent or refunded outcome
    (so the gateway stops retrying), 409 when the idempotency key or gateway transaction id belongs to another order.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request: Request) -> Response:
        gateway = get_payment_gateway()
        if not gateway.verify_callback(request):
            return Response({"detail": "Invalid signature."}, status=status.HTTP_403_FORBIDDEN)
        serializer = PaymentCallbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            payment = handle_callback(
                order_number=data["order_number"],
                idempotency_key=data["idempotency_key"],
                gateway=gateway.name,
                gateway_transaction_id=data["gateway_transaction_id"],
                amount=data["amount"],
                succeeded=data["status"] == "SUCCESS",
                method=data["method"],
                raw_response={**data, "amount": str(data["amount"])},
            )
        except Order.DoesNotExist:
            return Response({"detail": "Unknown order."}, status=status.HTTP_404_NOT_FOUND)
        except DuplicateGatewayTransaction:
            return Response(
                {"detail": "This callback or gateway transaction belongs to another order."}, status=status.HTTP_409_CONFLICT
            )
        return Response({"order_number": data["order_number"], "result": payment.status})
