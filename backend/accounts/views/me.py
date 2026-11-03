from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.serializers import MeSerializer


class MeView(APIView):
    """Current user (``GET``) and own name edits (``PATCH``, ``users.manage_self``)."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        return Response(MeSerializer(request.user).data)

    def patch(self, request: Request) -> Response:
        serializer = MeSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
