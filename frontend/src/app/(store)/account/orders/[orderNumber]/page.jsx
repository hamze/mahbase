import RequireCustomer from '@/components/RequireCustomer';
import OrderDetail from '@/views/OrderDetail';

export const metadata = { title: 'جزئیات سفارش', robots: { index: false, follow: false } };

export default async function OrderPage({ params }) {
  const { orderNumber } = await params;
  return (
    <RequireCustomer>
      <OrderDetail orderNumber={orderNumber} />
    </RequireCustomer>
  );
}
