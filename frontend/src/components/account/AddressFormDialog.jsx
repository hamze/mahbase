import React from 'react';
import { createAddress, updateAddress } from '@/api/account';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AddressForm from '@/components/store/AddressForm';

/** Create (``address`` empty) or edit an own address; ``onSaved`` receives the saved address. */
export default function AddressFormDialog({ open, onOpenChange, onSaved, address = null }) {
  const save = async (payload) => {
    const saved = address ? await updateAddress(address.id, payload) : await createAddress(payload);
    onOpenChange(false);
    onSaved?.(saved);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" dir="rtl">
        <DialogHeader><DialogTitle>{address ? 'ویرایش آدرس' : 'افزودن آدرس جدید'}</DialogTitle></DialogHeader>
        {open && (
          <AddressForm
            key={address?.id ?? 'new'}
            address={address}
            onSubmit={save}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
