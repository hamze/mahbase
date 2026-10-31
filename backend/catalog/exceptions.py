import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.serializers import as_serializer_error
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def exception_handler(exc: Exception, context: dict) -> Response | None:
    """Map model-level validation to 400 and constraint races (e.g. duplicate combination) to 409."""
    if isinstance(exc, DjangoValidationError):
        exc = ValidationError(as_serializer_error(exc))
    elif isinstance(exc, IntegrityError):
        logger.error(f"Integrity error: {str(exc)}", exc_info=True)
        return Response({"detail": "The change conflicts with existing data."}, status=status.HTTP_409_CONFLICT)
    return drf_exception_handler(exc, context)
