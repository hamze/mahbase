import { OrdersList } from "@/components/OrdersList";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const { search } = await searchParams;
  return <OrdersList initialSearch={search} />;
}
