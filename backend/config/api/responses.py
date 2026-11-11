from typing import Any, Dict, Union

from rest_framework import status
from rest_framework.response import Response

response_type = Dict[str, Union[str, int]]


class Responses:
    """Every API response type: ``code`` (the ``state`` field), HTTP ``status`` and the Persian ``message``.

    Body shape for every JSON response: ``{"state": code, "message": message, "data": ...}``. Successful view
    results are wrapped by ``EnvelopeJSONRenderer``; errors are built by the exception handler or a view with
    ``get_response``. Field-level validation details travel in ``data`` (``{field: [messages]}``).
    """

    class GENERAL:
        OK = {'code': 'success', 'status': status.HTTP_200_OK, 'message': 'success'}
        NOT_FOUND = {
            'code': 'not_found',
            'status': status.HTTP_404_NOT_FOUND,
            'message': 'داده مورد نظر یافت نشد',
        }
        WRONG_INPUTS = {
            'code': 'wrong_inputs',
            'status': status.HTTP_400_BAD_REQUEST,
            'message': 'داده های ورودی صحیح نمی باشد',
        }
        UNAUTHORIZED = {
            'code': 'unauthorized',
            'status': status.HTTP_401_UNAUTHORIZED,
            'message': 'ابتدا وارد حساب کاربری خود شوید',
        }
        FORBIDDEN = {
            'code': 'forbidden',
            'status': status.HTTP_403_FORBIDDEN,
            'message': 'عملیات مجاز نمی باشد',
        }
        METHOD_NOT_ALLOWED = {
            'code': 'method_not_allowed',
            'status': status.HTTP_405_METHOD_NOT_ALLOWED,
            'message': 'این نوع درخواست مجاز نیست',
        }
        CONFLICT = {
            'code': 'conflict',
            'status': status.HTTP_409_CONFLICT,
            'message': 'این تغییر با اطلاعات موجود تداخل دارد',
        }
        INVALID_STATE = {
            'code': 'invalid_state',
            'status': status.HTTP_409_CONFLICT,
            'message': 'این تغییر وضعیت مجاز نیست',
        }
        TOO_MANY_REQUESTS = {
            'code': 'too_many_requests',
            'status': status.HTTP_429_TOO_MANY_REQUESTS,
            'message': 'تعداد درخواست‌ها بیش از حد مجاز است، کمی بعد دوباره تلاش کنید',
        }
        SERVER_ERROR = {
            'code': 'server_error',
            'status': status.HTTP_500_INTERNAL_SERVER_ERROR,
            'message': 'خطای سرور، لطفا دوباره امتحان کنید.',
        }
        IDEMPOTENCY_KEY_REQUIRED = {
            'code': 'idempotency_key_required',
            'status': status.HTTP_400_BAD_REQUEST,
            'message': 'سربرگ Idempotency-Key (حداکثر ۶۴ نویسه) الزامی است',
        }
        IDEMPOTENCY_KEY_REUSED = {
            'code': 'idempotency_key_reused',
            'status': status.HTTP_409_CONFLICT,
            'message': 'این Idempotency-Key قبلا برای درخواست دیگری استفاده شده است',
        }

    class ACCOUNT_GENERAL:
        INVALID_OTP = {
            'code': 'invalid_otp',
            'status': status.HTTP_400_BAD_REQUEST,
            'message': 'کد وارد شده نامعتبر یا منقضی شده است',
        }
        SMS_SEND_FAILED = {
            'code': 'sms_send_failed',
            'status': status.HTTP_502_BAD_GATEWAY,
            'message': 'ارسال کد انجام نشد، لطفا دوباره امتحان کنید',
        }
        DISABLED = {
            'code': 'disabled',
            'status': status.HTTP_403_FORBIDDEN,
            'message': 'دسترسی این حساب کاربری غیرفعال است',
        }
        PASSWORD_CHANGED = {
            'code': 'password_changed',
            'status': status.HTTP_200_OK,
            'message': 'رمز عبور تغییر کرد',
        }

    class ORDER:
        ITEMS_REJECTED = {
            'code': 'order_items_rejected',
            'status': status.HTTP_422_UNPROCESSABLE_ENTITY,
            'message': 'برخی از اقلام سبد خرید قابل سفارش نیستند',
        }
        NOT_PAYABLE = {
            'code': 'order_not_payable',
            'status': status.HTTP_409_CONFLICT,
            'message': 'امکان پرداخت این سفارش وجود ندارد',
        }
        GATEWAY_ERROR = {
            'code': 'gateway_error',
            'status': status.HTTP_502_BAD_GATEWAY,
            'message': 'اتصال به درگاه پرداخت برقرار نشد، لطفا دوباره امتحان کنید',
        }

    class CATALOG:
        STOCK_BELOW_RESERVED = {
            'code': 'stock_below_reserved',
            'status': status.HTTP_409_CONFLICT,
            'message': 'موجودی جدید کمتر از مقدار رزرو شده سفارش‌هاست؛ برای ادامه تایید کنید',
        }
        REVIEWS_DISABLED = {
            'code': 'reviews_disabled',
            'status': status.HTTP_403_FORBIDDEN,
            'message': 'ثبت نظر برای محصولات غیرفعال است',
        }

    @classmethod
    def body(cls, res_type: response_type, data: Any = None) -> dict:
        response_data = {'state': res_type['code'], 'message': res_type['message']}

        if data is not None:
            response_data['data'] = data

        return response_data

    @classmethod
    def get_response(cls, res_type: response_type, data: Any = None, headers: dict | None = None) -> Response:
        response = Response(cls.body(res_type, data), status=res_type['status'], headers=headers)
        response.is_enveloped = True
        return response


# Sample usage:
# return Responses.get_response(Responses.GENERAL.NOT_FOUND)
