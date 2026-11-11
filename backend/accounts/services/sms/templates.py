"""The one place that names SMS templates.

Every message is a provider *pattern* (template) filled with ordered tokens, so providers never receive free text.
``SmsTemplate`` names what the code sends; each provider maps it to the template name created in its panel.
"""

from enum import StrEnum


class SmsTemplate(StrEnum):
    LOGIN_CODE = "LOGIN_CODE"  # tokens: code
    PASSWORD_RESET_CODE = "PASSWORD_RESET_CODE"  # tokens: code
    MOBILE_CHANGE_CODE = "MOBILE_CHANGE_CODE"  # tokens: code
    ORDER_PAID = "ORDER_PAID"  # tokens: order number
    ORDER_SHIPPED = "ORDER_SHIPPED"  # tokens: order number
    ORDER_DELIVERED = "ORDER_DELIVERED"  # tokens: order number
    ORDER_REFUNDED = "ORDER_REFUNDED"  # tokens: order number


# Template names as created in the Kavenegar panel (Verify/Lookup patterns).
KAVENEGAR_TEMPLATES: dict[SmsTemplate, str] = {
    SmsTemplate.LOGIN_CODE: "mahbase-login",
    SmsTemplate.PASSWORD_RESET_CODE: "mahbase-password-reset",
    SmsTemplate.MOBILE_CHANGE_CODE: "mahbase-mobile-change",
    SmsTemplate.ORDER_PAID: "mahbase-order-paid",
    SmsTemplate.ORDER_SHIPPED: "mahbase-order-shipped",
    SmsTemplate.ORDER_DELIVERED: "mahbase-order-delivered",
    SmsTemplate.ORDER_REFUNDED: "mahbase-order-refunded",
}
