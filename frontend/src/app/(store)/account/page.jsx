import RequireCustomer from '@/components/RequireCustomer';
import Account from '@/views/Account';

export const metadata = { title: 'حساب کاربری', robots: { index: false, follow: false } };

export default function AccountPage() {
  return (
    <RequireCustomer>
      <Account />
    </RequireCustomer>
  );
}
