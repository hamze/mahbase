import Link from 'next/link';

export default function PageNotFound() {
  return (
    <div className="container mx-auto px-4 py-24 text-center space-y-4">
      <p className="text-7xl font-light text-muted-foreground">۴۰۴</p>
      <h1 className="text-xl font-bold">صفحه مورد نظر پیدا نشد</h1>
      <Link href="/" className="inline-block text-primary underline">بازگشت به صفحه اصلی</Link>
    </div>
  );
}
