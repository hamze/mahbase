import Layout from '@/components/store/Layout';
import PageNotFound from '@/lib/PageNotFound';

export const metadata = { title: 'صفحه پیدا نشد', robots: { index: false } };

export default function NotFound() {
  return (
    <Layout>
      <PageNotFound />
    </Layout>
  );
}
