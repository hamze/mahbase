'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Check, CreditCard, Loader2, MapPin, Pencil, Plus, Tag, Truck, X } from 'lucide-react';
import { createAddress, listAddresses, updateAddress } from '@/api/account';
import { listShippingMethods, placeOrder, quoteOrder } from '@/api/orders';
import { useCart } from '@/lib/cart-context';
import { faNum, formatPrice, formatQuantity } from '@/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Image } from '@/components/ui/image';
import AddressForm from '@/components/store/AddressForm';
import { cn } from '@/lib/utils';

const STEPS = ['آدرس تحویل', 'روش ارسال', 'بازبینی و پرداخت'];

const quoteKey = (shippingMethod, discountCode, cartKey) => ['order-quote', shippingMethod, discountCode, cartKey];

function Steps({ step }) {
  return (
    <div className="mb-8 flex items-center">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1">
            <div className={cn('grid h-9 w-9 place-items-center rounded-full text-sm font-medium', i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              {i < step ? <Check className="h-4 w-4" /> : faNum(i + 1)}
            </div>
            <span className={cn('hidden text-xs sm:block', i <= step ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
          </div>
          {i < STEPS.length - 1 && <div className={cn('mx-2 h-0.5 flex-1', i < step ? 'bg-primary' : 'bg-muted')} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function AddressStep({ addresses, selected, onSelect, onEdit, onNext }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold text-foreground"><MapPin className="h-5 w-5 text-primary" /> آدرس تحویل</h2>
        <button onClick={() => onEdit('new')} className="flex items-center gap-1 text-sm text-primary hover:underline">
          <Plus className="h-4 w-4" /> آدرس جدید
        </button>
      </div>
      {addresses.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          هنوز آدرسی ثبت نکرده‌اید. برای ادامه یک آدرس اضافه کنید.
        </p>
      ) : (
        <div className="space-y-2">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={cn('flex items-start gap-3 rounded-xl border p-4 transition', selected?.id === address.id ? 'border-primary bg-primary/5' : 'border-border')}
            >
              <label className="flex flex-1 cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="address"
                  checked={selected?.id === address.id}
                  onChange={() => onSelect(address.id)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span className="text-sm leading-7">
                  <span className="font-medium text-foreground">
                    {address.title || address.receiver_name}
                    {address.is_default && <span className="mr-2 text-xs text-primary">(پیش‌فرض)</span>}
                  </span>
                  <span className="block text-muted-foreground">
                    {address.province_name}، {address.city_name}، {address.address_line}، پلاک {address.plaque}
                    {address.unit ? `، واحد ${address.unit}` : ''}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    گیرنده: {address.receiver_name} — {address.receiver_mobile} — کد پستی {address.postal_code}
                  </span>
                </span>
              </label>
              <button onClick={() => onEdit(address)} className="text-muted-foreground hover:text-primary" aria-label="ویرایش آدرس">
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={onNext}
        disabled={!selected}
        className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        ادامه
      </button>
    </div>
  );
}

function ShippingStep({ methods, selectedId, onSelect, onBack, onNext }) {
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 font-bold text-foreground"><Truck className="h-5 w-5 text-primary" /> روش ارسال</h2>
      {methods.isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : methods.isError ? (
        <p className="text-sm text-destructive">دریافت روش‌های ارسال انجام نشد.</p>
      ) : methods.data.length === 0 ? (
        <p className="rounded-xl bg-warning/10 p-4 text-sm text-warning">در حال حاضر ارسال به شهر این آدرس امکان‌پذیر نیست. آدرس دیگری انتخاب کنید.</p>
      ) : (
        <div className="space-y-2">
          {methods.data.map((method) => (
            <label
              key={method.id}
              className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition', selectedId === method.id ? 'border-primary bg-primary/5' : 'border-border')}
            >
              <input type="radio" name="shipping" checked={selectedId === method.id} onChange={() => onSelect(method.id)} className="mt-1 h-4 w-4 accent-primary" />
              <span className="flex-1 text-sm">
                <span className="font-medium text-foreground">{method.name}</span>
                {method.description && <span className="mt-1 block text-xs leading-6 text-muted-foreground">{method.description}</span>}
              </span>
              <span className="text-sm font-medium text-foreground">
                {Number(method.price) > 0 ? `${formatPrice(method.price)} تومان` : 'رایگان'}
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onBack} className="rounded-xl border border-border px-6 py-3 text-sm text-foreground hover:bg-muted">بازگشت</button>
        <button onClick={onNext} disabled={!selectedId} className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          ادامه
        </button>
      </div>
    </div>
  );
}

function DiscountForm({ applied, onApply, onRemove }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
        <span>کد تخفیف «{applied}» اعمال شد.</span>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive" aria-label="حذف کد تخفیف"><X className="h-4 w-4" /></button>
      </div>
    );
  }

  const apply = async (e) => {
    e.preventDefault();
    setChecking(true);
    setError((await onApply(code.trim())) || '');
    setChecking(false);
  };

  return (
    <form onSubmit={apply}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="کد تخفیف" className="h-10 w-full rounded-xl border border-border bg-background pl-3 pr-9 text-sm outline-none focus:border-primary" />
        </div>
        <button type="submit" disabled={!code.trim() || checking} className="flex items-center gap-1 rounded-xl border border-border px-4 text-sm text-foreground hover:bg-muted disabled:opacity-50">
          {checking && <Loader2 className="h-4 w-4 animate-spin" />} اعمال
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </form>
  );
}

function Row({ label, value, negative, className }) {
  return (
    <div className={cn('flex justify-between', className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className={negative ? 'text-success' : 'text-foreground'}>{negative ? '- ' : ''}{formatPrice(value)} تومان</span>
    </div>
  );
}

function QuoteSummary({ quote }) {
  const positive = (value) => Number(value) > 0;
  return (
    <div className="space-y-2 text-sm">
      <Row label="جمع کالاها" value={quote.subtotal_products} />
      {positive(quote.discount_amount) && (
        <Row label={`کد تخفیف${quote.discount_code_snapshot ? ` (${quote.discount_code_snapshot})` : ''}`} value={quote.discount_amount} negative />
      )}
      <Row label="هزینه ارسال" value={quote.shipping_cost} />
      {positive(quote.shipping_discount_amount) && <Row label="تخفیف ارسال" value={quote.shipping_discount_amount} negative />}
      {positive(quote.packaging_fee) && <Row label="هزینه بسته‌بندی" value={quote.packaging_fee} />}
      {positive(quote.tax_amount) && <Row label={`مالیات (${faNum(Number(quote.tax_percentage))}٪)`} value={quote.tax_amount} />}
      <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
        <span className="text-foreground">مبلغ قابل پرداخت</span>
        <span className="text-primary">{formatPrice(quote.payable_total)} تومان</span>
      </div>
      {positive(quote.product_discount_total) && (
        <p className="text-xs text-success">سود شما از تخفیف کالاها: {formatPrice(quote.product_discount_total)} تومان</p>
      )}
    </div>
  );
}

/** 422 body → readable lines: per-variant errors (named from the cart) and cart-level messages. */
function placementErrors(data, items) {
  const lines = Object.entries(data?.lines || {}).map(([variantId, line]) => {
    const item = items.find((i) => String(i.variant) === variantId);
    const name = item ? `${item.product_name}${item.variant_label ? ` (${item.variant_label})` : ''}` : line.sku;
    return `${name}: ${[line.errors].flat().join('، ')}`;
  });
  return [...lines, ...[data?.cart || []].flat()];
}

export default function Checkout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { items, refresh } = useCart();
  const [step, setStep] = useState(0);
  const [addressId, setAddressId] = useState(null);
  const [shippingId, setShippingId] = useState(null);
  const [discountCode, setDiscountCode] = useState('');
  const [editing, setEditing] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [placeErrors, setPlaceErrors] = useState([]);
  const idempotency = useRef({ attempt: null, key: null });

  const addresses = useQuery({ queryKey: ['addresses'], staleTime: 0, queryFn: listAddresses });
  const addressList = addresses.data || [];
  const address =
    addressList.find((a) => a.id === addressId) || addressList.find((a) => a.is_default) || addressList[0];

  const methods = useQuery({
    queryKey: ['shipping-methods', address?.city],
    queryFn: () => listShippingMethods(address.city),
    enabled: step >= 1 && Boolean(address),
  });
  const method = methods.data?.find((m) => m.id === shippingId);

  const cartKey = items.map((i) => `${i.variant}:${i.quantity}`).join(',');
  const quote = useQuery({
    queryKey: quoteKey(method?.id, discountCode, cartKey),
    queryFn: () => quoteOrder({ shippingMethod: method.id, discountCode }),
    enabled: step === 2 && Boolean(method) && items.length > 0,
    retry: false,
  });

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center text-muted-foreground">
        سبد خرید خالی است. <Link href="/products" className="text-primary hover:underline">مشاهده محصولات</Link>
      </div>
    );
  }

  const saveAddress = async (payload) => {
    const saved = editing === 'new' ? await createAddress(payload) : await updateAddress(editing.id, payload);
    await queryClient.invalidateQueries({ queryKey: ['addresses'] });
    setAddressId(saved.id);
    setEditing(null);
  };

  /** Validate a code by quoting with it; returns the error text or nothing. */
  const applyDiscount = async (code) => {
    try {
      await queryClient.fetchQuery({
        queryKey: quoteKey(method.id, code, cartKey),
        queryFn: () => quoteOrder({ shippingMethod: method.id, discountCode: code }),
        retry: false,
      });
      setDiscountCode(code);
      return '';
    } catch (error) {
      return [error.data?.discount_code].flat()[0] || error.messages?.[0] || 'کد تخفیف معتبر نیست.';
    }
  };

  const confirm = async () => {
    // One key per confirmation: a retry of the same request reuses it, a changed request gets a new one.
    const attempt = `${address.id}|${method.id}|${discountCode}`;
    if (idempotency.current.attempt !== attempt) idempotency.current = { attempt, key: crypto.randomUUID() };
    setPlacing(true);
    setPlaceErrors([]);
    try {
      const result = await placeOrder(
        { address: address.id, shippingMethod: method.id, discountCode },
        idempotency.current.key,
      );
      if (result.payment_redirect_url) {
        window.location.href = result.payment_redirect_url;
        return;
      }
      await refresh();
      toast.warning('سفارش ثبت شد اما اتصال به درگاه پرداخت برقرار نشد. از صفحه سفارش دوباره برای پرداخت اقدام کنید.');
      router.push(`/account/orders/${result.order_number}`);
    } catch (error) {
      if (error.status === 422) {
        setPlaceErrors(placementErrors(error.data, items));
        refresh();
      } else {
        setPlaceErrors([error.messages?.[0] || 'ثبت سفارش انجام نشد. دوباره تلاش کنید.']);
      }
      setPlacing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-6 text-xl font-bold text-foreground md:text-2xl">تکمیل خرید</h1>
      <Steps step={step} />

      <div className="rounded-2xl border border-border bg-card p-5">
        {step === 0 &&
          (addresses.isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <AddressStep
              addresses={addressList}
              selected={address}
              onSelect={setAddressId}
              onEdit={setEditing}
              onNext={() => setStep(1)}
            />
          ))}

        {step === 1 && (
          <ShippingStep
            methods={methods}
            selectedId={method?.id}
            onSelect={setShippingId}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="flex items-center gap-2 font-bold text-foreground"><CreditCard className="h-5 w-5 text-primary" /> بازبینی و پرداخت</h2>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-border p-3">
                <span className="text-xs text-muted-foreground">ارسال به</span>
                <p className="mt-1 leading-7 text-foreground">{address.receiver_name} — {address.city_name}، {address.address_line}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <span className="text-xs text-muted-foreground">روش ارسال</span>
                <p className="mt-1 text-foreground">{method.name}</p>
              </div>
            </div>

            <ul className="divide-y divide-border rounded-xl border border-border">
              {items.map((item) => (
                <li key={item.variant} className="flex items-center gap-3 p-3 text-sm">
                  <Image src={item.image_url} alt={item.product_name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-foreground">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.variant_label ? `${item.variant_label} — ` : ''}{formatQuantity(item.quantity)} {item.unit_name}
                    </p>
                  </div>
                  <span className="font-medium text-foreground">{formatPrice(item.line_total)} تومان</span>
                </li>
              ))}
            </ul>

            <DiscountForm key={discountCode} applied={discountCode} onApply={applyDiscount} onRemove={() => setDiscountCode('')} />

            {quote.isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : quote.isError ? (
              <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{quote.error.messages?.[0] || 'محاسبه مبلغ سفارش انجام نشد.'}</p>
            ) : (
              quote.data && <QuoteSummary quote={quote.data} />
            )}

            {placeErrors.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="mb-1 flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> ثبت سفارش انجام نشد</p>
                <ul className="list-disc space-y-1 pr-5 text-xs leading-6">
                  {placeErrors.map((message) => <li key={message}>{message}</li>)}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} disabled={placing} className="rounded-xl border border-border px-6 py-3 text-sm text-foreground hover:bg-muted disabled:opacity-50">
                بازگشت
              </button>
              <button
                onClick={confirm}
                disabled={placing || !quote.data}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {placing && <Loader2 className="h-4 w-4 animate-spin" />} ثبت سفارش و پرداخت آنلاین
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'آدرس جدید' : 'ویرایش آدرس'}</DialogTitle>
          </DialogHeader>
          {editing !== null && (
            <AddressForm
              key={editing === 'new' ? 'new' : editing.id}
              address={editing === 'new' ? null : editing}
              onSubmit={saveAddress}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
