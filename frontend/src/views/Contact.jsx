'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Mail, MapPin, Phone, Send } from 'lucide-react';
import { sendContactMessage } from '@/api/content';
import { persianDigits } from '@/lib/jalali';
import { useStoreSettings } from '@/hooks/use-site-content';
import { FieldError, GeneralError, splitApiErrors } from '@/components/account/form-errors';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const EMPTY = { name: '', mobile: '', email: '', subject: '', message: '' };
const inputCls = 'h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary';

export default function Contact() {
  const settings = useStoreSettings();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState(null);
  const [sending, setSending] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setErrors(null);
    try {
      await sendContactMessage(form);
      toast.success('پیام شما ارسال شد. به‌زودی با شما تماس می‌گیریم.');
      setForm(EMPTY);
    } catch (err) {
      setErrors(splitApiErrors(err, Object.keys(EMPTY)));
    }
    setSending(false);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground">تماس با ما</h1>
        <p className="mt-2 text-sm text-muted-foreground">سوال، پیشنهاد یا انتقاد خود را برای ما بفرستید.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <aside className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
          <h2 className="font-bold text-foreground">{settings?.store_name}</h2>
          {settings?.contact_phone && (
            <a href={`tel:${settings.contact_phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
              <Phone className="h-4 w-4 shrink-0" /> <span dir="ltr">{persianDigits(settings.contact_phone)}</span>
            </a>
          )}
          {settings?.contact_email && (
            <a href={`mailto:${settings.contact_email}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
              <Mail className="h-4 w-4 shrink-0" /> {settings.contact_email}
            </a>
          )}
          {settings?.address && (
            <p className="flex items-start gap-2 leading-6 text-muted-foreground">
              <MapPin className="mt-1 h-4 w-4 shrink-0" /> {settings.address}
            </p>
          )}
        </aside>

        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-5 md:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-sm">نام و نام خانوادگی *</Label>
              <input value={form.name} onChange={set('name')} className={inputCls} required />
              <FieldError errors={errors} name="name" />
            </div>
            <div>
              <Label className="mb-1 block text-sm">شماره موبایل *</Label>
              <input value={form.mobile} onChange={set('mobile')} inputMode="tel" dir="ltr" placeholder="09xxxxxxxxx" className={inputCls} required />
              <FieldError errors={errors} name="mobile" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-sm">ایمیل (اختیاری)</Label>
              <input type="email" value={form.email} onChange={set('email')} dir="ltr" className={inputCls} />
              <FieldError errors={errors} name="email" />
            </div>
            <div>
              <Label className="mb-1 block text-sm">موضوع *</Label>
              <input value={form.subject} onChange={set('subject')} className={inputCls} required />
              <FieldError errors={errors} name="subject" />
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-sm">پیام *</Label>
            <textarea value={form.message} onChange={set('message')} rows={5} className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary" required />
            <FieldError errors={errors} name="message" />
          </div>
          <GeneralError errors={errors} />
          <Button type="submit" disabled={sending} className="gap-2 rounded-xl">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ارسال پیام
          </Button>
        </form>
      </div>
    </div>
  );
}
