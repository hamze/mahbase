import logging
from urllib.parse import urlencode

from django.conf import settings
from django.http import HttpResponseRedirect
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.views import APIView

from commerce.models import PaymentAttempt, PaymentTransaction
from commerce.services.payments import DuplicateGatewayTransaction, complete_return

logger = logging.getLogger(__name__)


def storefront_result(**params: str) -> HttpResponseRedirect:
    return HttpResponseRedirect(f"{settings.STOREFRONT_URL}/checkout/result?{urlencode(params)}")


class PaymentReturnView(APIView):
    """``GET /api/payments/return/?authority=&status=OK|NOK`` — where the bank sends the customer back.

    A reported success is verified with the bank before it is applied; the customer is then redirected to the
    storefront result page with ``order``, ``status`` (success | failed | error), ``result`` (transaction status) and
    ``ref`` (bank tracking code).
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request: Request) -> HttpResponseRedirect:
        authority = request.query_params.get("authority", "")
        try:
            order, payment = complete_return(authority, request.query_params.get("status") == "OK")
        except (PaymentAttempt.DoesNotExist, DuplicateGatewayTransaction):
            # Unknown authority, or (logged by the service) a bank reference already recorded for another order.
            return storefront_result(status="error")
        except Exception as e:
            logger.error(f"Payment return for authority {authority} failed: {str(e)}", exc_info=True)
            return storefront_result(status="error")
        succeeded = payment.status == PaymentTransaction.Status.SUCCESS
        return storefront_result(
            order=order.order_number, status="success" if succeeded else "failed", result=payment.status,
            ref=payment.gateway_transaction_id or "",
        )
