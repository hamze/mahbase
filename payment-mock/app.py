"""Mock Iranian bank gateway (Zarinpal-style) for development and tests. Standard library only.

Merchant API (JSON, ``merchant_id`` must equal MOCK_BANK_MERCHANT_ID):
  POST /api/v1/request {amount, callback_url, order_id, description} → {code: 100, authority}
  POST /api/v1/verify  {authority, amount} → {code: 100 | 101 (already verified), ref_id, card_pan, amount}
                                              or {code: -51} (not paid) / {code: -50} (amount mismatch)
  POST /api/v1/refund  {ref_id, amount} → {code: 100, refund_id}
Customer pages:
  GET  /pay/{authority}  payment page with a "successful payment" and a "failed payment" button
  POST /pay/{authority}  action=success|fail → 303 to callback_url?authority=&status=OK|NOK&order_id=&ref_id=

Payments are kept in memory: restarting the service forgets them.
"""

import html
import json
import logging
import os
import secrets
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlencode

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("payment-mock")

MERCHANT_ID = os.environ.get("MOCK_BANK_MERCHANT_ID", "mahbase-test-merchant")
PORT = int(os.environ.get("MOCK_BANK_PORT", "8090"))

CODE_OK = 100
CODE_ALREADY_VERIFIED = 101
CODE_BAD_MERCHANT = -11
CODE_BAD_REQUEST = -9
CODE_AMOUNT_MISMATCH = -50
CODE_NOT_PAID = -51
CODE_UNKNOWN = -54

payments: dict[str, dict] = {}
lock = threading.Lock()


def request_payment(data: dict) -> dict:
    if not data.get("callback_url") or not data.get("amount"):
        return {"code": CODE_BAD_REQUEST}
    authority = "A" + secrets.token_hex(16)
    with lock:
        payments[authority] = {
            "amount": str(data["amount"]), "callback_url": data["callback_url"], "order_id": str(data.get("order_id", "")),
            "description": str(data.get("description", "")), "state": "NEW", "ref_id": None, "verified": False,
            "refunded": "0",
        }
    return {"code": CODE_OK, "authority": authority}


def verify_payment(data: dict) -> dict:
    with lock:
        payment = payments.get(str(data.get("authority", "")))
        if payment is None:
            return {"code": CODE_UNKNOWN}
        if payment["state"] != "PAID":
            return {"code": CODE_NOT_PAID}
        if str(data.get("amount")) != payment["amount"]:
            return {"code": CODE_AMOUNT_MISMATCH}
        code = CODE_ALREADY_VERIFIED if payment["verified"] else CODE_OK
        payment["verified"] = True
        return {"code": code, "ref_id": payment["ref_id"], "card_pan": "6037-99**-****-1234", "amount": payment["amount"]}


def refund_payment(data: dict) -> dict:
    with lock:
        payment = next((p for p in payments.values() if p["ref_id"] == str(data.get("ref_id"))), None)
        if payment is None or not payment["verified"]:
            return {"code": CODE_UNKNOWN}
        payment["refunded"] = str(float(payment["refunded"]) + float(data.get("amount", 0)))
    return {"code": CODE_OK, "refund_id": "R" + secrets.token_hex(8)}


API = {"/api/v1/request": request_payment, "/api/v1/verify": verify_payment, "/api/v1/refund": refund_payment}

PAGE = """<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>درگاه پرداخت آزمایشی</title>
<style>body{{font-family:Tahoma,sans-serif;background:#f3f4f6;margin:0;display:flex;min-height:100vh;
align-items:center;justify-content:center}}.box{{background:#fff;border-radius:12px;padding:28px;width:min(420px,92vw);
box-shadow:0 4px 20px #0001}}h1{{font-size:18px;margin:0 0 6px}}.note{{color:#b45309;font-size:13px;margin-bottom:18px}}
dl{{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;margin:0 0 22px}}dt{{color:#6b7280}}dd{{margin:0;font-weight:bold}}
button{{width:100%;padding:12px;border:0;border-radius:8px;font-size:15px;cursor:pointer;margin-top:10px;color:#fff}}
.ok{{background:#16a34a}}.fail{{background:#dc2626}}</style></head><body><div class="box">
<h1>درگاه پرداخت آزمایشی</h1><div class="note">این درگاه واقعی نیست و هیچ مبلغی کسر نمی‌شود.</div>
<dl><dt>شماره سفارش</dt><dd>{order_id}</dd><dt>مبلغ</dt><dd>{amount} تومان</dd><dt>شرح</dt><dd>{description}</dd></dl>
<form method="post"><button class="ok" name="action" value="success">پرداخت موفق</button>
<button class="fail" name="action" value="fail">پرداخت ناموفق</button></form></div></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: bytes, content_type: str, headers: dict | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, data: dict, status: int = 200) -> None:
        self._send(status, json.dumps(data).encode(), "application/json")

    def _body(self) -> bytes:
        return self.rfile.read(int(self.headers.get("Content-Length") or 0))

    def do_GET(self) -> None:
        if self.path == "/health":
            return self._json({"status": "ok"})
        authority = self.path.removeprefix("/pay/")
        payment = payments.get(authority) if self.path.startswith("/pay/") else None
        if payment is None:
            return self._send(404, "پرداخت پیدا نشد".encode(), "text/plain; charset=utf-8")
        page = PAGE.format(**{key: html.escape(payment[key]) for key in ("order_id", "amount", "description")})
        self._send(200, page.encode(), "text/html; charset=utf-8")

    def do_POST(self) -> None:
        if self.path in API:
            try:
                data = json.loads(self._body() or b"{}")
            except json.JSONDecodeError:
                return self._json({"code": CODE_BAD_REQUEST}, 400)
            if data.get("merchant_id") != MERCHANT_ID:
                return self._json({"code": CODE_BAD_MERCHANT})
            result = API[self.path](data)
            logger.info(f"{self.path} → {result.get('code')}")
            return self._json(result)
        authority = self.path.removeprefix("/pay/")
        with lock:
            payment = payments.get(authority) if self.path.startswith("/pay/") else None
            if payment is None:
                return self._send(404, b"Not found", "text/plain")
            succeeded = parse_qs(self._body().decode()).get("action") == ["success"]
            if payment["state"] == "NEW":
                payment["state"] = "PAID" if succeeded else "FAILED"
                payment["ref_id"] = str(secrets.randbelow(10 ** 10)).zfill(10) if succeeded else None
            paid = payment["state"] == "PAID"
            query = urlencode({
                "authority": authority, "status": "OK" if paid else "NOK", "order_id": payment["order_id"],
                "ref_id": payment["ref_id"] or "",
            })
            target = payment["callback_url"] + ("&" if "?" in payment["callback_url"] else "?") + query
        self._send(303, b"", "text/plain", {"Location": target})


if __name__ == "__main__":
    logger.info(f"Mock bank listening on :{PORT}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
