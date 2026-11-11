import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.http import Http404
from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.serializers import as_serializer_error
from rest_framework.views import exception_handler as drf_exception_handler

from config.api.responses import Responses, response_type

logger = logging.getLogger(__name__)


class ResponseError(exceptions.APIException):
    """Raise a ``Responses`` type (with optional ``data``) from anywhere under a view."""

    def __init__(self, res_type: response_type, data: object = None) -> None:
        super().__init__(res_type["message"])
        self.res_type = res_type
        self.data = data


# Most specific first: NotAuthenticated/AuthenticationFailed before the generic APIException fallback.
EXCEPTION_TYPES = [
    (exceptions.ValidationError, Responses.GENERAL.WRONG_INPUTS),
    (exceptions.ParseError, Responses.GENERAL.WRONG_INPUTS),
    (exceptions.UnsupportedMediaType, Responses.GENERAL.WRONG_INPUTS),
    (exceptions.NotAuthenticated, Responses.GENERAL.UNAUTHORIZED),
    (exceptions.AuthenticationFailed, Responses.GENERAL.UNAUTHORIZED),
    (exceptions.PermissionDenied, Responses.GENERAL.FORBIDDEN),
    (exceptions.NotFound, Responses.GENERAL.NOT_FOUND),
    (exceptions.MethodNotAllowed, Responses.GENERAL.METHOD_NOT_ALLOWED),
    (exceptions.Throttled, Responses.GENERAL.TOO_MANY_REQUESTS),
]


def exception_handler(exc: Exception, context: dict) -> Response:
    """Every API error as a ``Responses`` envelope.

    Model validation → ``wrong_inputs`` (400), invalid state transitions → ``invalid_state`` (409), constraint
    races → ``conflict`` (409). Validation details and specific permission/authentication messages go in ``data``; DRF's headers
    (``WWW-Authenticate``, ``Retry-After``) are kept. Anything unexpected is logged and returned as ``server_error``.
    """
    from commerce.models import InvalidTransition

    if isinstance(exc, ResponseError):
        return Responses.get_response(exc.res_type, exc.data)
    if isinstance(exc, InvalidTransition):
        return Responses.get_response(Responses.GENERAL.INVALID_STATE, [str(exc)])
    if isinstance(exc, IntegrityError):
        logger.error(f"Integrity error: {str(exc)}", exc_info=True)
        return Responses.get_response(Responses.GENERAL.CONFLICT)
    if isinstance(exc, DjangoValidationError):
        exc = exceptions.ValidationError(as_serializer_error(exc))
    elif isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()

    response = drf_exception_handler(exc, context)
    if response is None:
        logger.error(f"Unhandled API error: {str(exc)}", exc_info=True)
        return Responses.get_response(Responses.GENERAL.SERVER_ERROR)

    res_type = next((res for kind, res in EXCEPTION_TYPES if isinstance(exc, kind)), None)
    if isinstance(exc, exceptions.ValidationError):
        data = exc.detail
    elif isinstance(exc, exceptions.Throttled):
        data = {"retry_after": exc.wait}
    elif (
        isinstance(exc, (exceptions.PermissionDenied, exceptions.AuthenticationFailed))
        and isinstance(exc.detail, str)
        and str(exc.detail) != str(exc.default_detail)
    ):
        data = [str(exc.detail)]
    else:
        data = None
    if res_type is None:
        res_type = {"code": getattr(exc, "default_code", "error"), "status": response.status_code, "message": str(exc.detail)}
        data = None
    headers = {key: value for key, value in response.items() if key in ("WWW-Authenticate", "Retry-After", "Allow")}
    return Responses.get_response(res_type, data, headers=headers)
