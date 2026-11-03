from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer

from accounts.permissions import IsCustomer
from catalog.models import Product
from commerce.models import AuditLog, ProductQuestion
from commerce.serializers import (
    ProductQuestionAnswerSerializer,
    ProductQuestionSerializer,
    PublicProductQuestionSerializer,
)
from commerce.views.base import AdminPermissionMixin


class ProductQuestionListView(generics.ListCreateAPIView):
    """``GET /api/products/{id}/questions/`` — answered public questions (public);
    ``POST`` — a customer asks a question (pending moderation).
    """

    serializer_class = PublicProductQuestionSerializer

    def get_permissions(self) -> list:
        return [IsCustomer()] if self.request.method == "POST" else [AllowAny()]

    def get_queryset(self) -> QuerySet:
        return ProductQuestion.objects.filter(
            product_id=self.kwargs["product_id"], status=ProductQuestion.Status.ANSWERED, is_public=True
        )

    def perform_create(self, serializer: BaseSerializer) -> None:
        product = get_object_or_404(Product, pk=self.kwargs["product_id"], is_published=True, deleted_at__isnull=True)
        serializer.save(product=product, user=self.request.user, created_by_type=ProductQuestion.CreatedByType.CUSTOMER)


class AdminProductQuestionViewSet(AdminPermissionMixin, viewsets.ModelViewSet):
    """``/api/admin/product-questions/`` — moderation: ``answer`` (sanitized, optionally public), ``reject``,
    ``toggle-public``.
    """

    serializer_class = ProductQuestionSerializer
    manage_permission = "admin.product_questions.answer"
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self) -> QuerySet:
        questions = ProductQuestion.objects.select_related("product", "user")
        if question_status := self.request.query_params.get("status"):
            questions = questions.filter(status=question_status)
        if product := self.request.query_params.get("product"):
            questions = questions.filter(product_id=product)
        return questions

    def perform_create(self, serializer: BaseSerializer) -> None:
        serializer.save(created_by_type=ProductQuestion.CreatedByType.ADMIN)

    @action(detail=True, methods=["post"])
    def answer(self, request: Request, pk: str) -> Response:
        question = self.get_object()
        serializer = ProductQuestionAnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        question.answer(request.user, serializer.validated_data["answer_text"], serializer.validated_data["is_public"])
        AuditLog.record(request.user, "product_question.answer", question, is_public=question.is_public)
        return Response(self.get_serializer(question).data)

    @action(detail=True, methods=["post"])
    def reject(self, request: Request, pk: str) -> Response:
        question = self.get_object()
        question.reject()
        AuditLog.record(request.user, "product_question.reject", question)
        return Response(self.get_serializer(question).data)

    @action(detail=True, methods=["post"], url_path="toggle-public")
    def toggle_public(self, request: Request, pk: str) -> Response:
        question = self.get_object()
        question.is_public = not question.is_public
        question.save(update_fields=["is_public"])
        return Response(self.get_serializer(question).data)
