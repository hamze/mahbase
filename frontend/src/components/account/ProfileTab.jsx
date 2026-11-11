import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil } from 'lucide-react';
import { confirmMobileChange, requestMobileChange, updateMe } from '@/api/auth';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldError, GeneralError, splitApiErrors } from './form-errors';

const inputCls = 'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary';

function MobileChangeDialog({ open, onOpenChange }) {
  const { reloadUser } = useAuth();
  const [phase, setPhase] = useState('new');
  const [newMobile, setNewMobile] = useState('');
  const [oldCode, setOldCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [errors, setErrors] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPhase('new');
      setNewMobile('');
      setOldCode('');
      setNewCode('');
      setErrors(null);
    }
  }, [open]);

  const sendCodes = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors(null);
    try {
      await requestMobileChange(newMobile.trim());
      setPhase('codes');
    } catch (err) {
      setErrors(splitApiErrors(err, ['new_mobile']));
    }
    setBusy(false);
  };

  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors(null);
    try {
      await confirmMobileChange(newMobile.trim(), oldCode.trim(), newCode.trim());
      await reloadUser();
      toast.success('شماره موبایل با موفقیت تغییر کرد.');
      onOpenChange(false);
    } catch (err) {
      setErrors(splitApiErrors(err, ['new_mobile', 'old_code', 'new_code']));
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>تغییر شماره موبایل</DialogTitle></DialogHeader>
        {phase === 'new' ? (
          <form onSubmit={sendCodes} className="space-y-3">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">شماره موبایل جدید</Label>
              <input value={newMobile} onChange={(e) => setNewMobile(e.target.value)} inputMode="tel" dir="ltr" placeholder="09xxxxxxxxx" className={inputCls} required />
              <FieldError errors={errors} name="new_mobile" />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">یک کد تایید به شماره فعلی و یک کد به شماره جدید پیامک می‌شود.</p>
            <GeneralError errors={errors} />
            <Button type="submit" disabled={busy || !newMobile.trim()} className="w-full gap-2 rounded-xl">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} ارسال کدهای تایید
            </Button>
          </form>
        ) : (
          <form onSubmit={confirm} className="space-y-3">
            <FieldError errors={errors} name="new_mobile" />
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">کد ارسال‌شده به شماره فعلی</Label>
              <input value={oldCode} onChange={(e) => setOldCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={10} className={inputCls} required />
              <FieldError errors={errors} name="old_code" />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">کد ارسال‌شده به شماره جدید</Label>
              <input value={newCode} onChange={(e) => setNewCode(e.target.value)} inputMode="numeric" dir="ltr" maxLength={10} className={inputCls} required />
              <FieldError errors={errors} name="new_code" />
            </div>
            <GeneralError errors={errors} />
            <Button type="submit" disabled={busy || !oldCode.trim() || !newCode.trim()} className="w-full gap-2 rounded-xl">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} تایید و تغییر شماره
            </Button>
            <button type="button" onClick={() => setPhase('new')} className="w-full text-center text-xs text-muted-foreground hover:text-primary">
              ویرایش شماره جدید
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ProfileTab() {
  const { user, reloadUser } = useAuth();
  const [firstName, setFirstName] = useState(user.first_name || '');
  const [lastName, setLastName] = useState(user.last_name || '');
  const [errors, setErrors] = useState(null);
  const [saving, setSaving] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors(null);
    try {
      await updateMe({ first_name: firstName.trim(), last_name: lastName.trim() });
      await reloadUser();
      toast.success('اطلاعات حساب ذخیره شد.');
    } catch (err) {
      setErrors(splitApiErrors(err, ['first_name', 'last_name']));
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={saveName} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-bold text-foreground">اطلاعات شخصی</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">نام</Label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
            <FieldError errors={errors} name="first_name" />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">نام خانوادگی</Label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
            <FieldError errors={errors} name="last_name" />
          </div>
        </div>
        <GeneralError errors={errors} />
        <Button type="submit" disabled={saving} className="gap-2 rounded-xl">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} ذخیره
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
        <div>
          <h2 className="font-bold text-foreground">شماره موبایل</h2>
          <p className="mt-1 text-sm text-muted-foreground" dir="ltr">{user.username}</p>
        </div>
        <button onClick={() => setMobileOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5">
          <Pencil className="h-4 w-4" /> تغییر شماره
        </button>
      </div>

      <MobileChangeDialog open={mobileOpen} onOpenChange={setMobileOpen} />
    </div>
  );
}
