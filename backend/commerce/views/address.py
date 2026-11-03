from django.db.models import QuerySet
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer

from accounts.permissions import IsCustomer
from commerce.models import Address
from commerce.serializers import AddressSerializer


class AddressViewSet(viewsets.ModelViewSet):
    """``/api/me/addresses/`` — own addresses; DELETE soft-deletes, ``PATCH {id}/default/`` makes one the default."""

    permission_classes = [IsCustomer]
    serializer_class = AddressSerializer
    pagination_class = None

    def get_queryset(self) -> QuerySet:
        return Address.objects.active().filter(user=self.request.user).select_related("province", "city")

    def perform_create(self, serializer: BaseSerializer) -> None:
        address = serializer.save(user=self.request.user)
        if not Address.objects.active().filter(user=self.request.user, is_default=True).exists():
            address.make_default()

    def perform_destroy(self, address: Address) -> None:
        address.soft_delete()

    @action(detail=True, methods=["patch"])
    def default(self, request: Request, pk: str) -> Response:
        address = self.get_object()
        address.make_default()
        return Response(self.get_serializer(address).data)
