import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { deleteAddress, listAddresses, setDefaultAddress } from '@/api/account';
import Badge from '@/components/store/Badge';
import AddressFormDialog from './AddressFormDialog';

export function addressText(address) {
  return [
    address.province_name,
    address.city_name,
    address.address_line,
    address.plaque && `پلاک ${address.plaque}`,
    address.unit && `واحد ${address.unit}`,
  ].filter(Boolean).join('، ');
}

export default function AddressesTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['addresses'], staleTime: 0, queryFn: listAddresses });
  const addresses = data || [];
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const reload = () => queryClient.invalidateQueries({ queryKey: ['addresses'] });

  const run = async (call, success) => {
    try {
      await call();
      toast.success(success);
      reload();
    } catch (err) {
      toast.error(err.messages?.join(' ') || 'عملیات انجام نشد.');
    }
  };

  const remove = (address) => {
    if (window.confirm('این آدرس حذف شود؟')) run(() => deleteAddress(address.id), 'آدرس حذف شد.');
  };

  const openForm = (address) => {
    setEditing(address);
    setDialogOpen(true);
  };

  if (isLoading) return <div className="h-32 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="space-y-3">
      {addresses.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">آدرسی ثبت نشده است.</div>
      )}
      {addresses.map((a) => (
        <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                {a.title && <span>{a.title}</span>}
                {a.is_default && <Badge label="پیش‌فرض" tone="primary" />}
              </div>
              <div className="text-foreground">{a.receiver_name} — <span dir="ltr">{a.receiver_mobile}</span></div>
              <div className="leading-6 text-muted-foreground">{addressText(a)}</div>
              <div className="text-xs text-muted-foreground">کد پستی: <span dir="ltr">{a.postal_code}</span></div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={() => openForm(a)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary" aria-label="ویرایش">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => remove(a)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="حذف">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          {!a.is_default && (
            <button
              onClick={() => run(() => setDefaultAddress(a.id), 'آدرس پیش‌فرض تغییر کرد.')}
              className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Star className="h-3.5 w-3.5" /> انتخاب به‌عنوان آدرس پیش‌فرض
            </button>
          )}
        </div>
      ))}
      <button onClick={() => openForm(null)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
        <Plus className="h-4 w-4" /> افزودن آدرس جدید
      </button>
      <AddressFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        address={editing}
        onSaved={() => {
          toast.success('آدرس ذخیره شد.');
          reload();
        }}
      />
    </div>
  );
}
