from django.urls import path
from rest_framework_simplejwt.views import TokenBlacklistView, TokenObtainPairView, TokenRefreshView

from accounts import views

urlpatterns = [
    path("token/", TokenObtainPairView.as_view(), name="token-obtain"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", TokenBlacklistView.as_view(), name="token-blacklist"),
    path("me/", views.MeView.as_view(), name="me"),
    path("otp/request/", views.OTPRequestView.as_view(), name="otp-request"),
    path("mobile/change/request/", views.MobileChangeRequestView.as_view(), name="mobile-change-request"),
    path("mobile/change/confirm/", views.MobileChangeConfirmView.as_view(), name="mobile-change-confirm"),
    path("otp/verify/", views.OTPVerifyView.as_view(), name="otp-verify"),
    path("password/reset/request/", views.PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password/reset/confirm/", views.PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]
