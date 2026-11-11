import RequireCustomer from '@/components/RequireCustomer';
import Checkout from '@/views/Checkout';

export const metadata = { title: 'تکمیل خرید', robots: { index: false, follow: false } };

export default function CheckoutPage() {
  return (
    <RequireCustomer>
      <Checkout />
    </RequireCustomer>
  );
}
