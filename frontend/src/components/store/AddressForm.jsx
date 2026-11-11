import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MapPin } from 'lucide-react';
import { listCities, listProvinces } from '@/api/account';
import dynamic from 'next/dynamic';

// Leaflet needs the browser (window), so the map loads on the client only.
const LocationPicker = dynamic(() => import('./LocationPicker'), { ssr: false });

const inputCls = 'h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary';

const toForm = (address) => ({
  title: address?.title ?? '',
  receiver_name: address?.receiver_name ?? '',
  receiver_mobile: address?.receiver_mobile ?? '',
  province: address?.province ?? '',
  city: address?.city ?? '',
  address_line: address?.address_line ?? '',
  postal_code: address?.postal_code ?? '',
  plaque: address?.plaque ?? '',
  unit: address?.unit ?? '',
});

const toPin = (address) =>
  address?.latitude != null ? { lat: Number(address.latitude), lng: Number(address.longitude) } : null;

function Field({ label, error, optional, className, children }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs text-muted-foreground">{label}{optional ? ' (اختیاری)' : ' *'}</label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Address fields with province/city selects for all of Iran and an optional map pin. ``onSubmit(payload)`` saves it
 * and may throw an ``ApiError``; its field errors are shown next to the fields.
 */
export default function AddressForm({ address, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => toForm(address));
  const [pin, setPin] = useState(() => toPin(address));
  const [showMap, setShowMap] = useState(() => Boolean(toPin(address)));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const provinces = useQuery({ queryKey: ['provinces'], queryFn: listProvinces, staleTime: Infinity });
  const cities = useQuery({
    queryKey: ['cities', form.province],
    queryFn: () => listCities(form.province),
    enabled: Boolean(form.province),
    staleTime: Infinity,
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await onSubmit({
        ...form,
        province: Number(form.province) || null,
        city: Number(form.city) || null,
        latitude: pin ? pin.lat.toFixed(6) : null,
        longitude: pin ? pin.lng.toFixed(6) : null,
      });
    } catch (error) {
      const data = error.data && typeof error.data === 'object' && !Array.isArray(error.data) ? error.data : {};
      const fieldErrors = Object.fromEntries(
        Object.entries(data).filter(([key]) => key in form || key === 'latitude').map(([key, value]) => [key, [value].flat()[0]]),
      );
      const general = Object.keys(fieldErrors).length === 0 ? error.messages?.[0] || 'ذخیره آدرس انجام نشد.' : '';
      setErrors({ ...fieldErrors, general });
    }
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="عنوان آدرس" error={errors.title}>
          <input value={form.title} onChange={set('title')} placeholder="مثلاً خانه" className={inputCls} />
        </Field>
        <Field label="نام گیرنده" error={errors.receiver_name}>
          <input value={form.receiver_name} onChange={set('receiver_name')} className={inputCls} required />
        </Field>
        <Field label="موبایل گیرنده" error={errors.receiver_mobile}>
          <input value={form.receiver_mobile} onChange={set('receiver_mobile')} dir="ltr" inputMode="numeric" placeholder="09xxxxxxxxx" className={inputCls} required />
        </Field>
        <Field label="کد پستی" error={errors.postal_code}>
          <input value={form.postal_code} onChange={set('postal_code')} dir="ltr" inputMode="numeric" maxLength={10} className={inputCls} required />
        </Field>
        <Field label="استان" error={errors.province}>
          <select
            value={form.province}
            onChange={(e) => setForm((f) => ({ ...f, province: e.target.value, city: '' }))}
            className={inputCls}
            required
          >
            <option value="">انتخاب استان</option>
            {(provinces.data || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="شهر" error={errors.city}>
          <select value={form.city} onChange={set('city')} disabled={!form.province} className={inputCls} required>
            <option value="">{cities.isLoading ? 'در حال بارگذاری...' : 'انتخاب شهر'}</option>
            {(cities.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="نشانی" error={errors.address_line} className="sm:col-span-2">
          <textarea value={form.address_line} onChange={set('address_line')} rows={2} className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary" required />
        </Field>
        <Field label="پلاک" error={errors.plaque} optional>
          <input value={form.plaque} onChange={set('plaque')} className={inputCls} />
        </Field>
        <Field label="واحد" error={errors.unit} optional>
          <input value={form.unit} onChange={set('unit')} className={inputCls} />
        </Field>
      </div>

      <div>
        {showMap ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">برای دقیق‌تر شدن ارسال، محل را روی نقشه مشخص کنید (اختیاری).</p>
            <LocationPicker value={pin} onChange={setPin} />
            <button type="button" onClick={() => { setPin(null); setShowMap(false); }} className="text-xs text-muted-foreground hover:text-destructive">
              حذف موقعیت روی نقشه
            </button>
            {errors.latitude && <p className="text-xs text-destructive">{errors.latitude}</p>}
          </div>
        ) : (
          <button type="button" onClick={() => setShowMap(true)} className="flex items-center gap-1 text-sm text-primary hover:underline">
            <MapPin className="h-4 w-4" /> افزودن موقعیت روی نقشه (اختیاری)
          </button>
        )}
      </div>

      {errors.general && <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{errors.general}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} ذخیره آدرس
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-xl border border-border px-6 py-3 text-sm text-foreground hover:bg-muted">
            انصراف
          </button>
        )}
      </div>
    </form>
  );
}
